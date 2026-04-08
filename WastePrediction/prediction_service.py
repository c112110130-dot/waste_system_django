"""
Prediction service layer for WastePrediction module.
Separates complex prediction logic from view layer for better maintainability.
"""
import logging
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Any, Optional
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score
from scipy import stats
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

from .models import HospitalOperationalData
from MedicalWasteManagementSystem.date_validators import validate_date_format

logger = logging.getLogger(__name__)


class DataPreprocessor:
    """Handles data preprocessing for prediction algorithms."""
    
    @staticmethod
    def remove_extreme_values(df: pd.DataFrame, columns: List[str], z_threshold: float = 3.0) -> pd.DataFrame:
        """
        Remove extreme values using Z-score method.
        
        Args:
            df: Input dataframe
            columns: Columns to check for extreme values
            z_threshold: Z-score threshold for outlier detection
            
        Returns:
            Cleaned dataframe
        """
        df_cleaned = df.copy()
        
        for column in columns:
            if column in df_cleaned.columns and df_cleaned[column].dtype in ['int64', 'float64']:
                z_scores = np.abs(stats.zscore(df_cleaned[column].dropna()))
                df_cleaned = df_cleaned[z_scores <= z_threshold]
        
        return df_cleaned
    
    @staticmethod
    def prepare_prediction_data(date_str: str, selected_fields: List[str]) -> Optional[Dict[str, float]]:
        """
        Prepare data for prediction calculation.
        
        Args:
            date_str: Target date in YYYY-MM format
            selected_fields: List of fields to include in prediction
            
        Returns:
            Dictionary of field values or None if no data
        """
        try:
            # Get the latest available data before the target date
            target_date = datetime.strptime(date_str, '%Y-%m')
            
            # Look for data in the 12 months before target date
            start_date = target_date - relativedelta(months=12)
            
            data = HospitalOperationalData.objects.filter(
                date__gte=start_date.strftime('%Y-%m'),
                date__lt=date_str
            ).order_by('-date').first()
            
            if not data:
                return None
            
            # Extract values for selected fields
            data_dict = {}
            for field in selected_fields:
                value = getattr(data, field, None)
                if value is not None:
                    data_dict[field] = float(value)
                else:
                    data_dict[field] = 0.0
            
            return data_dict
            
        except Exception as e:
            logger.error(f"Error preparing prediction data: {e}")
            return None


class RegressionAnalyzer:
    """Handles regression analysis and model fitting."""
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.model = None
    
    def calculate_regression(self, x: np.ndarray, y: np.ndarray) -> Dict[str, float]:
        """
        Calculate linear regression coefficients.
        
        Args:
            x: Independent variable data
            y: Dependent variable data
            
        Returns:
            Dictionary with slope and intercept
        """
        try:
            if len(x) < 2 or len(y) < 2:
                return {'slope': 0.0, 'intercept': 0.0}
            
            # Remove NaN values
            valid_mask = ~(np.isnan(x) | np.isnan(y))
            x_clean = x[valid_mask]
            y_clean = y[valid_mask]
            
            if len(x_clean) < 2:
                return {'slope': 0.0, 'intercept': 0.0}
            
            slope, intercept, r_value, p_value, std_err = stats.linregress(x_clean, y_clean)
            
            return {
                'slope': slope,
                'intercept': intercept,
                'r_value': r_value,
                'r_squared': r_value ** 2,
                'p_value': p_value,
                'std_err': std_err
            }
            
        except Exception as e:
            logger.error(f"Error in regression calculation: {e}")
            return {'slope': 0.0, 'intercept': 0.0}
    
    def calculate_r2_score(self, x: np.ndarray, y: np.ndarray) -> float:
        """
        Calculate R-squared score.
        
        Args:
            x: Independent variable data
            y: Dependent variable data
            
        Returns:
            R-squared score
        """
        try:
            if len(x) < 2 or len(y) < 2:
                return 0.0
            
            # Remove NaN values
            valid_mask = ~(np.isnan(x) | np.isnan(y))
            x_clean = x[valid_mask]
            y_clean = y[valid_mask]
            
            if len(x_clean) < 2:
                return 0.0
            
            # Simple linear regression
            slope, intercept = np.polyfit(x_clean, y_clean, 1)
            y_pred = slope * x_clean + intercept
            
            return r2_score(y_clean, y_pred)
            
        except Exception as e:
            logger.error(f"Error calculating R2 score: {e}")
            return 0.0
    
    def run_regression_algorithm(self, X: pd.DataFrame, y: pd.Series) -> Dict[str, Any]:
        """
        Run comprehensive regression analysis.
        
        Args:
            X: Feature dataframe
            y: Target variable series
            
        Returns:
            Dictionary with regression results
        """
        try:
            # Validate input
            if X.empty or y.empty or len(X) != len(y):
                return self._empty_regression_result()
            
            # Remove rows with NaN values
            combined_data = pd.concat([X, y], axis=1)
            combined_data = combined_data.dropna()
            
            if combined_data.empty or len(combined_data) < 3:
                return self._empty_regression_result()
            
            # Split back into X and y
            X_clean = combined_data.iloc[:, :-1]
            y_clean = combined_data.iloc[:, -1]
            
            # Fit the model
            model = LinearRegression()
            model.fit(X_clean, y_clean)
            
            # Calculate predictions
            y_pred = model.predict(X_clean)
            
            # Calculate metrics
            r2 = r2_score(y_clean, y_pred)
            mse = np.mean((y_clean - y_pred) ** 2)
            rmse = np.sqrt(mse)
            
            # Calculate feature importance (coefficients)
            feature_importance = {}
            for i, feature in enumerate(X_clean.columns):
                feature_importance[feature] = model.coef_[i]
            
            return {
                'model': model,
                'r2_score': r2,
                'mse': mse,
                'rmse': rmse,
                'coefficients': model.coef_.tolist(),
                'intercept': model.intercept_,
                'feature_importance': feature_importance,
                'n_features': X_clean.shape[1],
                'n_samples': X_clean.shape[0],
                'predictions': y_pred.tolist(),
                'actual_values': y_clean.tolist()
            }
            
        except Exception as e:
            logger.error(f"Error in regression algorithm: {e}")
            return self._empty_regression_result()
    
    def _empty_regression_result(self) -> Dict[str, Any]:
        """Return empty regression result structure."""
        return {
            'model': None,
            'r2_score': 0.0,
            'mse': 0.0,
            'rmse': 0.0,
            'coefficients': [],
            'intercept': 0.0,
            'feature_importance': {},
            'n_features': 0,
            'n_samples': 0,
            'predictions': [],
            'actual_values': []
        }


class PredictionService:
    """Main service for waste prediction operations."""
    
    def __init__(self):
        self.preprocessor = DataPreprocessor()
        self.analyzer = RegressionAnalyzer()
    
    def calculate_prediction(
        self, 
        target_field: str, 
        selected_fields: List[str], 
        date_range_months: int = 24
    ) -> Dict[str, Any]:
        """
        Calculate prediction using regression analysis.
        
        Args:
            target_field: Field to predict
            selected_fields: Fields to use as predictors
            date_range_months: Number of months of historical data to use
            
        Returns:
            Dictionary with prediction results
        """
        try:
            # Get historical data
            end_date = datetime.now()
            start_date = end_date - relativedelta(months=date_range_months)
            
            # Query data
            queryset = HospitalOperationalData.objects.filter(
                date__gte=start_date.strftime('%Y-%m'),
                date__lte=end_date.strftime('%Y-%m')
            ).order_by('date')
            
            if not queryset.exists():
                return {'success': False, 'error': '沒有足夠的歷史資料進行預測'}
            
            # Convert to DataFrame
            data = []
            for record in queryset:
                row = {'date': record.date}
                for field in selected_fields + [target_field]:
                    value = getattr(record, field, None)
                    row[field] = value if value is not None else 0
                data.append(row)
            
            df = pd.DataFrame(data)
            
            # Validate data
            if df.empty or len(df) < 3:
                return {'success': False, 'error': '資料不足，無法進行預測分析'}
            
            # Remove extreme values
            df_cleaned = self.preprocessor.remove_extreme_values(
                df, selected_fields + [target_field]
            )
            
            if df_cleaned.empty:
                return {'success': False, 'error': '清理異常值後資料不足'}
            
            # Prepare features and target
            X = df_cleaned[selected_fields]
            y = df_cleaned[target_field]
            
            # Run regression analysis
            regression_results = self.analyzer.run_regression_algorithm(X, y)
            
            if regression_results['model'] is None:
                return {'success': False, 'error': '無法建立有效的預測模型'}
            
            # Calculate next month prediction
            next_month = self._calculate_next_month(end_date.strftime('%Y-%m'))
            prediction_data = self.preprocessor.prepare_prediction_data(next_month, selected_fields)
            
            predicted_value = 0.0
            if prediction_data and regression_results['model']:
                try:
                    X_pred = pd.DataFrame([prediction_data])
                    predicted_value = regression_results['model'].predict(X_pred)[0]
                    predicted_value = max(0, predicted_value)  # Ensure non-negative
                except Exception as e:
                    logger.warning(f"Error calculating prediction: {e}")
            
            return {
                'success': True,
                'results': {
                    'predicted_value': predicted_value,
                    'target_field': target_field,
                    'predictor_fields': selected_fields,
                    'r2_score': regression_results['r2_score'],
                    'mse': regression_results['mse'],
                    'rmse': regression_results['rmse'],
                    'feature_importance': regression_results['feature_importance'],
                    'n_samples': regression_results['n_samples'],
                    'next_month': next_month,
                    'model_performance': {
                        'r2_score': regression_results['r2_score'],
                        'quality': self._assess_model_quality(regression_results['r2_score'])
                    }
                }
            }
            
        except Exception as e:
            logger.error(f"Error in prediction calculation: {e}")
            return {'success': False, 'error': f'預測計算發生錯誤: {str(e)}'}
    
    def calculate_correlation(
        self, 
        field1: str, 
        field2: str, 
        date_range_months: int = 24
    ) -> Dict[str, Any]:
        """
        Calculate correlation between two fields.
        
        Args:
            field1: First field
            field2: Second field
            date_range_months: Number of months of data to analyze
            
        Returns:
            Dictionary with correlation results
        """
        try:
            # Get historical data
            end_date = datetime.now()
            start_date = end_date - relativedelta(months=date_range_months)
            
            # Query data
            queryset = HospitalOperationalData.objects.filter(
                date__gte=start_date.strftime('%Y-%m'),
                date__lte=end_date.strftime('%Y-%m')
            ).order_by('date')
            
            if not queryset.exists():
                return {'success': False, 'error': '沒有足夠的資料進行相關性分析'}
            
            # Extract field values
            field1_values = []
            field2_values = []
            dates = []
            
            for record in queryset:
                val1 = getattr(record, field1, None)
                val2 = getattr(record, field2, None)
                
                if val1 is not None and val2 is not None:
                    field1_values.append(float(val1))
                    field2_values.append(float(val2))
                    dates.append(record.date)
            
            if len(field1_values) < 3:
                return {'success': False, 'error': '有效資料點不足，無法進行相關性分析'}
            
            # Convert to numpy arrays
            x = np.array(field1_values)
            y = np.array(field2_values)
            
            # Calculate correlation
            correlation_coef = np.corrcoef(x, y)[0, 1]
            
            # Calculate regression
            regression_results = self.analyzer.calculate_regression(x, y)
            
            return {
                'success': True,
                'results': {
                    'correlation_coefficient': correlation_coef,
                    'correlation_strength': self._assess_correlation_strength(correlation_coef),
                    'regression': regression_results,
                    'n_samples': len(field1_values),
                    'field1': field1,
                    'field2': field2,
                    'date_range': f"{start_date.strftime('%Y-%m')} to {end_date.strftime('%Y-%m')}"
                }
            }
            
        except Exception as e:
            logger.error(f"Error in correlation calculation: {e}")
            return {'success': False, 'error': f'相關性計算發生錯誤: {str(e)}'}
    
    def _calculate_next_month(self, current_date: str) -> str:
        """Calculate next month from current date string."""
        try:
            date_obj = datetime.strptime(current_date, '%Y-%m')
            next_month = date_obj + relativedelta(months=1)
            return next_month.strftime('%Y-%m')
        except Exception:
            return current_date
    
    def _assess_model_quality(self, r2_score: float) -> str:
        """Assess model quality based on R2 score."""
        if r2_score >= 0.8:
            return "優秀"
        elif r2_score >= 0.6:
            return "良好"
        elif r2_score >= 0.4:
            return "普通"
        else:
            return "較差"
    
    def _assess_correlation_strength(self, correlation: float) -> str:
        """Assess correlation strength."""
        abs_corr = abs(correlation)
        if abs_corr >= 0.8:
            return "強相關"
        elif abs_corr >= 0.5:
            return "中度相關"
        elif abs_corr >= 0.3:
            return "弱相關"
        else:
            return "無明顯相關"


class PredictionBatchProcessor:
    """Handles batch operations for prediction data."""
    
    def __init__(self):
        self.model = HospitalOperationalData
        self.field_info = self.model.FIELD_INFO if hasattr(self.model, 'FIELD_INFO') else {}
    
    def process_batch_import(self, rows: List[Dict[str, Any]], override_conflicts: bool = False) -> Dict[str, Any]:
        """
        Process batch import of hospital operational data.
        
        Args:
            rows: List of row data
            override_conflicts: Whether to override existing records
            
        Returns:
            Processing results
        """
        from MedicalWasteManagementSystem.shared_utils import BatchProcessor
        
        batch_processor = BatchProcessor()
        batch_processor.initialize_results(len(rows))
        
        # Validate and process each row
        validated_rows = []
        for idx, row in enumerate(rows):
            # Validate date format
            date_value = row.get('date', '').strip()
            if not validate_date_format(date_value):
                batch_processor.add_failure(idx, "無效的日期格式")
                continue
            
            # Validate and convert field values
            validated_data, errors = self._validate_and_convert_fields(row)
            
            if errors:
                batch_processor.add_failure(idx, "; ".join(errors))
                continue
            
            validated_rows.append((idx, validated_data))
        
        if not validated_rows:
            return batch_processor.get_results()
        
        # Check for conflicts
        dates_to_check = [row[1]['date'] for row in validated_rows]
        existing_dates = set(
            self.model.objects.filter(date__in=dates_to_check).values_list('date', flat=True)
        )
        
        # Process rows
        for original_idx, validated_data in validated_rows:
            date_value = validated_data['date']
            
            try:
                if date_value in existing_dates:
                    if override_conflicts:
                        # Update existing record
                        self.model.objects.filter(date=date_value).update(**{
                            k: v for k, v in validated_data.items() if k != 'date'
                        })
                        batch_processor.increment_success()
                    else:
                        batch_processor.add_conflict(original_idx, date_value, "資料已存在")
                else:
                    # Create new record
                    self.model.objects.create(**validated_data)
                    batch_processor.increment_success()
                    
            except Exception as e:
                logger.error(f"Error processing row {original_idx}: {e}")
                batch_processor.add_failure(original_idx, f"處理失敗: {str(e)}")
        
        return batch_processor.get_results()
    
    def _validate_and_convert_fields(self, row_data: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
        """Validate and convert field values."""
        validated_data = {}
        errors = []
        
        # Process date field
        date_value = row_data.get('date', '').strip()
        validated_data['date'] = date_value
        
        # Process other fields
        for field_name, field_info in self.field_info.items():
            if field_name == 'date':
                continue
            
            raw_value = row_data.get(field_name, '')
            
            if raw_value == '' or raw_value is None:
                validated_data[field_name] = None
            else:
                try:
                    # Convert to float for numeric fields
                    numeric_value = float(str(raw_value).strip())
                    
                    # Validate range based on field type
                    if field_info.get('unit') == 'percent' and (numeric_value < 0 or numeric_value > 100):
                        errors.append(f"{field_name} 百分比數值應在 0-100 之間")
                    elif numeric_value < 0:
                        errors.append(f"{field_name} 不能為負數")
                    else:
                        validated_data[field_name] = numeric_value
                        
                except (ValueError, TypeError):
                    errors.append(f"{field_name} 數值格式無效")
        
        return validated_data, errors