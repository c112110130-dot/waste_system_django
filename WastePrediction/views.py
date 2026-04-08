import json
import logging
import time

import numpy as np
import pandas as pd
import statsmodels.api as sm
from django.db import connections, OperationalError
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt, csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from scipy import stats
from statsmodels.stats.outliers_influence import variance_inflation_factor

from MedicalWasteManagementSystem.permissions import permission_required
from MedicalWasteManagementSystem.utils import (
    validate_date_format, BatchProcessor, create_error_response,
    create_success_response, handle_common_errors, QueryOptimizer
)
from WastePrediction.models import HospitalOperationalData

# Set up logging
logger = logging.getLogger(__name__)


def calculate_regression(x, y):
    """Calculate slope and intercept for linear regression"""
    x = np.array(x, dtype=float)
    y = np.array(y, dtype=float)

    # Check if all x values are identical
    if len(x) < 2 or np.all(x == x[0]):
        # When all x values are identical, cannot calculate slope, return horizontal line
        return 0.0, float(np.mean(y)) if not np.isnan(np.mean(y)) else 0.0

    try:
        # Use scipy.stats.linregress
        slope, intercept, _, _, _ = stats.linregress(x, y)
        # Handle NaN values
        slope = float(slope) if not np.isnan(slope) else 0.0
        intercept = float(intercept) if not np.isnan(intercept) else 0.0
        return slope, intercept
    except Exception as e:
        logger.error(f"Regression calculation error: {str(e)}")
        # Return horizontal line when error occurs
        return 0.0, float(np.mean(y)) if not np.isnan(np.mean(y)) else 0.0


def calculate_r2(x, y):
    """Calculate R-squared value"""
    x = np.array(x, dtype=float)
    y = np.array(y, dtype=float)

    # Check if sufficient data and x values have variation
    if len(x) < 2 or np.all(x == x[0]):
        return 0.0  # R² is 0 when x doesn't vary (can't explain any variation)

    try:
        # Calculate Pearson correlation coefficient
        r, _ = stats.pearsonr(x, y)
        return float(r ** 2)
    except Exception as e:
        logger.error(f"R-squared calculation error: {str(e)}")
        return 0.0  # Default to 0 when error occurs


def remove_extreme_values(df, columns, z_threshold=3.0):
    """
    Remove extreme outliers from DataFrame based on Z-score

    Args:
        df: Pandas DataFrame to clean
        columns: List of column names to check for outliers
        z_threshold: Z-score threshold (default 3.0 - values beyond 3 standard deviations are considered outliers)

    Returns:
        Cleaned DataFrame with extreme values removed
    """
    # Make a copy to avoid modifying the original
    df_clean = df.copy()

    # Track number of outliers removed
    total_outliers = 0
    outliers_per_column = {}

    for col in columns:
        # Skip columns that don't exist or are not numeric
        if col not in df.columns or not pd.api.types.is_numeric_dtype(df[col]):
            continue

        # Need at least 3 data points to calculate meaningful z-scores
        if len(df[col].dropna()) < 3:
            continue

        # Calculate z-scores for current column
        z_scores = np.abs((df[col] - df[col].mean()) / df[col].std())

        # Count outliers for this column
        outliers = z_scores > z_threshold
        column_outliers = outliers.sum()

        if column_outliers > 0:
            outliers_per_column[col] = column_outliers
            total_outliers += column_outliers

            # Only mark as NaN, don't actually remove rows
            # This is just for tracking extreme values
            # We'll handle missing values separately later
            df_clean.loc[outliers, col] = df[col]  # Keep original values, don't mark as NaN

    # Log outlier information
    if total_outliers > 0:
        logger.info(f"Found {total_outliers} extreme values across {len(outliers_per_column)} columns")
        logger.info(f"Outliers per column: {outliers_per_column}")

    # Return cleaned dataframe - now we're just using this for logging, not actual removal
    return df_clean


@require_http_methods(["POST"])
def calculate_prediction(request):
    """Calculate waste prediction using modular prediction service."""
    try:
        data = json.loads(request.body)
        target_field = data.get('target_field', 'medical_waste_total')
        selected_fields = data.get('selected_fields', [])
        date_range_months = data.get('date_range_months', 24)
        
        # If no selected_fields provided, use all available fields except the target field
        if not selected_fields:
            from .models import HospitalOperationalData
            all_fields = list(HospitalOperationalData.FIELD_INFO.keys())
            selected_fields = [field for field in all_fields if field != target_field]

        # Get start and end dates from the request
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        if not start_date or not end_date:
            return JsonResponse({'success': False, 'error': '必須提供開始和結束日期'})

        # Get data from database within the date range
        data_within_range = HospitalOperationalData.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        ).order_by('date').values()

        if not data_within_range:
            return JsonResponse({'success': False, 'error': '所選日期範圍內沒有資料'})

        # Convert to DataFrame
        df = pd.DataFrame(list(data_within_range))

        # Sort DataFrame by date and calculate next_month_waste
        df['date'] = pd.to_datetime(df['date'].apply(lambda x: x + '-01'))
        df = df.sort_values('date')

        # Calculate next valid month's waste for each month
        df['next_month_waste'] = float('nan')  # Initialize with NaN
        for i in range(len(df) - 1):
            for j in range(i + 1, len(df)):
                if pd.notna(df.iloc[j]['medical_waste_total']):
                    df.iloc[i, df.columns.get_loc('next_month_waste')] = float(df.iloc[j]['medical_waste_total'])
                    break

        # Define required fields
        required_fields = [f for f in HospitalOperationalData.FIELD_INFO.keys()]

        # Log extreme values but don't remove them
        fields_to_check = required_fields.copy()
        clean_df = remove_extreme_values(df, fields_to_check, z_threshold=3.0)

        # Check for missing values directly within the date range
        missing_fields = {}
        for field in required_fields:
            null_dates = df[df[field].isnull()]['date'].dt.strftime('%Y-%m').tolist()
            if null_dates:
                missing_fields[field] = null_dates

        # If any missing values are found in the required fields, return error with details
        if missing_fields:
            error_msg = "以下欄位在所選日期範圍內有缺漏值:\n"
            for field, dates in missing_fields.items():
                field_name = HospitalOperationalData.FIELD_INFO[field]["name"]
                error_msg += f"- {field_name}: {', '.join(dates)}\n"
            return JsonResponse({'success': False, 'error': error_msg})

        # Filter rows with next_month_waste (our target variable)
        clean_df = df[df['next_month_waste'].notna()]

        # If no valid data
        if len(clean_df) == 0:
            return JsonResponse(
                {'success': False, 'error': '所選日期範圍內沒有後續月份的廢棄物總量資料，無法訓練預測模型'})

        # Check if data amount is sufficient for regression analysis
        if len(clean_df) <= len(required_fields) + 1:  # Need more sample points than variables
            return JsonResponse({
                'success': False,
                'error': f'所選日期範圍內的有效數據點({len(clean_df)}筆)不足以建立穩定的回歸模型，至少需要{len(required_fields) + 2}筆資料'
            })

        # Check if independent variables have variation
        field_info = HospitalOperationalData.FIELD_INFO
        for field in required_fields:
            if clean_df[field].nunique() <= 1:
                return JsonResponse({
                    'success': False,
                    'error': f'所選日期範圍內「{field_info[field]["name"]}」欄位數值完全相同，無法進行有效的回歸分析。請擴大日期範圍，確保數據有變化。'
                })

        # Define X and y variables
        X = clean_df[required_fields]
        y = clean_df['next_month_waste']

        # Run the regression algorithm
        result = run_regression_algorithm(X, y)

        # Prepare next month date
        next_month_date = calculate_next_month(end_date)

        # Get prediction data from the end date (NOT the next month)
        prediction_data = get_data_for_prediction(end_date, required_fields)

        # Check if we have complete data for prediction
        if prediction_data is None:
            return JsonResponse({
                'success': False,
                'error': f'無法取得 {end_date} 的完整資料，請確認該月份資料是否已登錄'
            })

        prediction_value = calculate_prediction_value(result['model'], prediction_data)

        # If prediction failed, return error
        if prediction_value is None:
            return JsonResponse({
                'success': False,
                'error': f'無法進行預測計算，模型或資料不完整'
            })

        return JsonResponse({
            'success': True,
            'prediction_date': next_month_date,
            'prediction_value': prediction_value,
            'r_squared': result['r_squared'],
            'valid_data_count': len(clean_df),
            'input_values': prediction_data,  # Add this line to include input values
            'vif_values': result['vif_values'],
            'p_values': result['p_values'],
            'correlations': result['correlations'],
            'coefficients': result['coefficients'],
            'removed_variables': result['removed_variables'],
            'infinity_flags': result['infinity_flags']  # Add flags to identify infinite values
        })

    except ValueError as ve:
        logger.error(f"Prediction calculation value error: {str(ve)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f"數值計算錯誤: {str(ve)}"})
    except np.linalg.LinAlgError as lae:
        logger.error(f"Matrix calculation error: {str(lae)}", exc_info=True)
        return JsonResponse(
            {'success': False, 'error': "無法計算預測：所選資料存在共線性問題，請選擇更多或更有變化的資料"})
    except Exception as e:
        logger.error(f"Prediction calculation error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f"計算錯誤: {str(e)}"})


@require_http_methods(["POST"])
def calculate_correlation(request):
    """Calculate correlations for scatter plots based on selected date range"""
    try:
        data = json.loads(request.body)
        start_date = data.get('start_date')
        end_date = data.get('end_date')

        if not start_date or not end_date:
            return JsonResponse({'success': False, 'error': '必須提供開始和結束日期'})

        # Get data from database within range
        data_within_range = HospitalOperationalData.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        ).order_by('date').values()

        if not data_within_range:
            return JsonResponse({'success': False, 'error': '所選日期範圍內沒有資料'})

        # Create DataFrame and calculate next month's waste
        df = pd.DataFrame(list(data_within_range))
        df['date'] = pd.to_datetime(df['date'].apply(lambda x: x + '-01'))
        df = df.sort_values('date')

        df['next_month_waste'] = float('nan')
        for i in range(len(df) - 1):
            for j in range(i + 1, len(df)):
                if pd.notna(df.iloc[j]['medical_waste_total']):
                    df.iloc[i, df.columns.get_loc('next_month_waste')] = float(df.iloc[j]['medical_waste_total'])
                    break

        # Map database fields to Chinese names
        field_mapping = {
            '佔床率': 'bed_occupancy_rate',
            '手術人次': 'surgical_cases',
            '醫師人數': 'doctor_count',
            '護理人數': 'nurse_count',
            '全院員工數': 'total_staff_count',
            '門診人次': 'outpatient_visits',
            '急診人次': 'emergency_visits',
            '住院人次': 'inpatient_visits',
            '本月廢棄物總量': 'medical_waste_total',
            '次月廢棄物總量': 'next_month_waste'
        }

        # Create renamed dataframe
        correlation_df = pd.DataFrame()
        for var_name, field_name in field_mapping.items():
            if field_name in df.columns:
                correlation_df[var_name] = pd.to_numeric(df[field_name], errors='coerce')

        variables = list(correlation_df.columns)
        correlations = {}

        for row_var in variables:
            correlations[row_var] = {}
            for col_var in variables:
                try:
                    if len(correlation_df) > 0 and row_var in correlation_df.columns and col_var in correlation_df.columns:
                        # Create data points for scatter plot, removing any NaN values
                        valid_indices = correlation_df[[col_var, row_var]].dropna().index
                        data_points = [{'x': float(correlation_df.loc[idx, col_var]),
                                        'y': float(correlation_df.loc[idx, row_var])}
                                       for idx in valid_indices]

                        if len(data_points) >= 2:
                            x_vals = [p['x'] for p in data_points]
                            y_vals = [p['y'] for p in data_points]

                            # Check if x values have variation
                            if len(set(x_vals)) < 2:
                                r2_value = 0
                                slope = 0
                                intercept = np.mean(y_vals) if y_vals else 0
                            else:
                                try:
                                    r2_value = calculate_r2(x_vals, y_vals)
                                    slope, intercept = calculate_regression(x_vals, y_vals)
                                except Exception as e:
                                    logger.error(f"Error in regression calculation: {str(e)}")
                                    r2_value = 0
                                    slope = 0
                                    intercept = 0
                        else:
                            r2_value = 0
                            slope = 0
                            intercept = 0
                    else:
                        data_points = []
                        r2_value = 0
                        slope = 0
                        intercept = 0
                except Exception as e:
                    logger.error(f"Error calculating correlation ({row_var}/{col_var}): {str(e)}")
                    data_points = data_points if 'data_points' in locals() else []
                    r2_value = 0
                    slope = 0
                    intercept = 0

                # Ensure JSON-safe values (convert any NaN to null)
                if isinstance(r2_value, (float, np.float64)) and np.isnan(r2_value):
                    r2_value = None
                if isinstance(slope, (float, np.float64)) and np.isnan(slope):
                    slope = None
                if isinstance(intercept, (float, np.float64)) and np.isnan(intercept):
                    intercept = None

                # Check for NaN in data points
                for point in data_points:
                    if isinstance(point['x'], (float, np.float64)) and np.isnan(point['x']):
                        point['x'] = None
                    if isinstance(point['y'], (float, np.float64)) and np.isnan(point['y']):
                        point['y'] = None

                correlations[row_var][col_var] = {
                    'points': data_points,
                    'r2': r2_value,
                    'slope': slope,
                    'intercept': intercept
                }

        # Ensure all numerics are converted to built-in Python types for JSON serialization
        for row_var in correlations:
            for col_var in correlations[row_var]:
                corr = correlations[row_var][col_var]
                corr['r2'] = float(corr['r2']) if corr['r2'] is not None else None
                corr['slope'] = float(corr['slope']) if corr['slope'] is not None else None
                corr['intercept'] = float(corr['intercept']) if corr['intercept'] is not None else None

        return JsonResponse({
            'success': True,
            'variables': variables,
            'correlations': correlations
        }, json_dumps_params={'default': lambda x: None if isinstance(x, (np.float64, float)) and np.isnan(x) else x})

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': '無效的請求格式'})
    except Exception as e:
        logger.error(f"相關性分析錯誤: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f"計算相關係數時發生錯誤: {str(e)}"})


def run_regression_algorithm(X, y):
    """Run the 4-stage regression algorithm from main.py"""
    # Create a copy to avoid modifying the original
    X_orig = X.copy()

    # Track removed variables
    removed_variables = {
        'stage_one': [],
        'stage_two': [],
        'stage_three': [],
        'stage_four': []
    }

    # Add constant term
    X = sm.add_constant(X)

    # CHANGE 2: Store initial values for ALL variables before any are removed
    # Initialize dictionaries to store statistics for ALL variables
    all_vif_data = {'const': 0}  # VIF for constant is technically 0
    all_p_values = {}  # We'll compute p-values for each step
    correlations = {}  # Correlation with target variable

    # Calculate correlations for all variables
    for feature in X_orig.columns:
        corr, _ = stats.pearsonr(X_orig[feature], y)
        correlations[feature] = corr

    # Stage 1: Identify variables with infinite VIF (but don't remove them yet for tracking)
    stage_one_problematic = []

    for i, feature in enumerate(X.columns):
        if feature == 'const':
            continue
        try:
            vif_value = variance_inflation_factor(X.values, i)
            # Convert infinity to a very large number for JSON serialization
            if np.isinf(vif_value):
                all_vif_data[feature] = 1.0e10  # Use large number instead of infinity
                stage_one_problematic.append(feature)
            else:
                all_vif_data[feature] = float(vif_value)
        except Exception as e:
            logger.error(f"Error calculating VIF for {feature}: {str(e)}")
            all_vif_data[feature] = 1.0e10  # Use large number instead of infinity for failed calculations
            stage_one_problematic.append(feature)

    # Now remove problematic variables for the next stages
    X_clean = X.drop(columns=stage_one_problematic)
    removed_variables['stage_one'] = stage_one_problematic

    # Initial OLS fit to get p-values before variable removal
    try:
        initial_model = sm.OLS(y, X).fit()
        for feature in initial_model.pvalues.index:
            all_p_values[feature] = float(initial_model.pvalues[feature])
    except Exception as e:
        logger.error(f"Error in initial OLS model: {str(e)}")
        # If initial model fails due to singularity, handle each variable individually
        for feature in X.columns:
            if feature == 'const':
                all_p_values[feature] = 1.0  # Default value
                continue
            try:
                # Try single variable regression for each feature
                X_single = sm.add_constant(pd.DataFrame({feature: X[feature]}))
                model_single = sm.OLS(y, X_single).fit()
                all_p_values[feature] = float(model_single.pvalues[feature])
            except:
                all_p_values[feature] = 1.0  # Default value if regression fails

    # Stage 2: Remove variables with correlation < 0.7
    stage_two_removes = []
    for feature in X_clean.columns:
        if feature == 'const':
            continue
        if abs(correlations.get(feature, 0)) < 0.7:
            stage_two_removes.append(feature)

    X_clean = X_clean.drop(columns=stage_two_removes)
    removed_variables['stage_two'] = stage_two_removes

    # Stage 3: Remove variables with p > 0.05
    stage_three_removes = []
    while True:
        if len(X_clean.columns) <= 1:  # Only const left
            break

        try:
            model = sm.OLS(y, X_clean).fit()
            max_p = 0
            max_p_feature = None

            for feature, p_value in model.pvalues.items():
                # Update p-values dictionary with latest values
                all_p_values[feature] = float(p_value)
                if feature != 'const' and p_value > 0.05 and p_value > max_p:
                    max_p = p_value
                    max_p_feature = feature

            if max_p_feature:
                stage_three_removes.append(max_p_feature)
                X_clean = X_clean.drop(columns=[max_p_feature])
            else:
                break
        except Exception as e:
            logger.error(f"Error in stage 3 OLS: {str(e)}")
            break

    removed_variables['stage_three'] = stage_three_removes

    # Stage 4: Remove variables with VIF > 10
    stage_four_removes = []
    while True:
        if len(X_clean.columns) <= 2:  # Only const and one variable left
            break

        max_vif = 0
        max_vif_feature = None

        for i, feature in enumerate(X_clean.columns):
            if feature == 'const':
                continue
            try:
                vif_value = variance_inflation_factor(X_clean.values, i)
                # Update the all_vif_data dictionary with the latest VIF value
                all_vif_data[feature] = float(vif_value)
                if vif_value > 10 and vif_value > max_vif:
                    max_vif = vif_value
                    max_vif_feature = feature
            except Exception as e:
                logger.error(f"Error calculating VIF for {feature} in stage 4: {str(e)}")
                continue

        if max_vif_feature:
            stage_four_removes.append(max_vif_feature)
            X_clean = X_clean.drop(columns=[max_vif_feature])
        else:
            break

    removed_variables['stage_four'] = stage_four_removes

    # Final model
    try:
        final_model = sm.OLS(y, X_clean).fit()

        # Update p-values for the final model variables
        for feature in final_model.pvalues.index:
            all_p_values[feature] = float(final_model.pvalues[feature])

        # Update VIF values for final model
        for i, feature in enumerate(X_clean.columns):
            if feature == 'const':
                continue
            vif_value = variance_inflation_factor(X_clean.values, i)
            # Handle infinity values for JSON serialization
            if np.isinf(vif_value):
                all_vif_data[feature] = 1.0e10
            else:
                all_vif_data[feature] = float(vif_value)

        # Calculate final coefficients
        final_coefficients = {'const': float(final_model.params['const'])}

        # Get all variables from original data
        for feature in X_orig.columns:
            if feature in final_model.params:
                final_coefficients[feature] = float(final_model.params[feature])
            else:
                final_coefficients[feature] = None

        # Ensure all values are JSON serializable (convert any infinity values)
        sanitized_vif = {}
        infinity_flags = {'vif': []}  # Track which values are actually infinity

        for key, value in all_vif_data.items():
            if value is None:
                sanitized_vif[key] = None
            elif np.isinf(value):
                sanitized_vif[key] = 1.0e10  # Use large number instead of infinity
                infinity_flags['vif'].append(key)  # Mark this key as infinity
            else:
                sanitized_vif[key] = float(value)

        # Also sanitize p-values and correlations
        sanitized_p_values = {}
        for key, value in all_p_values.items():
            if value is None:
                sanitized_p_values[key] = None
            else:
                sanitized_p_values[key] = float(value)

        sanitized_correlations = {}
        for key, value in correlations.items():
            if value is None:
                sanitized_correlations[key] = None
            elif np.isinf(value):
                sanitized_correlations[key] = 1.0 if value > 0 else -1.0  # Max correlation
            else:
                sanitized_correlations[key] = float(value)

        return {
            'model': final_model,
            'r_squared': float(final_model.rsquared),
            'vif_values': sanitized_vif,
            'p_values': sanitized_p_values,
            'correlations': sanitized_correlations,
            'coefficients': final_coefficients,
            'removed_variables': removed_variables,
            'infinity_flags': infinity_flags  # Add flags to identify infinite values
        }

    except Exception as e:
        logger.error(f"Error in final model: {str(e)}")
        # In case of failure, return default values
        return {
            'model': None,
            'r_squared': 0,
            'vif_values': all_vif_data,
            'p_values': all_p_values,
            'correlations': correlations,
            'coefficients': {f: None for f in X_orig.columns},
            'removed_variables': removed_variables
        }


def calculate_next_month(date_str):
    """Calculate the next month after the given date"""
    year, month = map(int, date_str.split('-'))

    if month == 12:
        year += 1
        month = 1
    else:
        month += 1

    return f"{year:04d}-{month:02d}"


def get_data_for_prediction(date_str, fields):
    """Get data for the specified date for prediction"""
    try:
        # Find the data from the training period's end date
        data = HospitalOperationalData.objects.get(date=date_str)

        # Create a dictionary with the data
        data_dict = {'const': 1.0}
        for field in fields:
            data_dict[field] = getattr(data, field)

        return data_dict
    except HospitalOperationalData.DoesNotExist:
        # If the data doesn't exist, return None
        return None


def calculate_prediction_value(model, data_dict):
    """Calculate prediction based on the model and data"""
    if not data_dict:
        return None

    # Create prediction DataFrame with only the variables used in the model
    predict_data = {}
    for feature in model.params.index:
        if feature in data_dict:
            # Skip features with None values
            if data_dict[feature] is not None:
                predict_data[feature] = [data_dict[feature]]
            else:
                # If essential feature is missing, prediction can't be made accurately
                return None

    # If we don't have sufficient data for prediction, return None
    if len(predict_data) < len(model.params.index):
        return None

    predict_df = pd.DataFrame(predict_data)

    # Make prediction
    prediction = model.predict(predict_df)
    return float(prediction[0])


@ensure_csrf_cookie
def prediction_index(request):
    # Get data from the database
    all_data = list(HospitalOperationalData.objects.all().order_by('date').values())

    # Filter out records without medical_waste_total (Y)
    valid_data = [d for d in all_data if d.get('medical_waste_total') is not None]

    if valid_data:
        df = pd.DataFrame(valid_data)

        # Sort DataFrame by date
        df['date'] = pd.to_datetime(df['date'].apply(lambda x: x + '-01'))
        df = df.sort_values('date')

        # Calculate next valid month's waste for each month
        # A valid month is one with complete data, especially waste data
        df['next_month_waste'] = float('nan')  # Initialize with NaN
        for i in range(len(df) - 1):
            # For each row, look forward to find the most recent valid month
            for j in range(i + 1, len(df)):
                if pd.notna(df.iloc[j]['medical_waste_total']):
                    df.iloc[i, df.columns.get_loc('next_month_waste')] = float(df.iloc[j]['medical_waste_total'])
                    break

        # Map database fields to actual field names in Chinese for better visualization
        field_mapping = {
            '佔床率': 'bed_occupancy_rate',
            '手術人次': 'surgical_cases',
            '醫師人數': 'doctor_count',
            '護理人數': 'nurse_count',
            '全院員工數': 'total_staff_count',
            '門診人次': 'outpatient_visits',
            '急診人次': 'emergency_visits',
            '住院人次': 'inpatient_visits',
            '本月廢棄物總量': 'medical_waste_total',
            '次月廢棄物總量': 'next_month_waste'
        }

        # Create renamed dataframe
        correlation_df = pd.DataFrame()
        for var_name, field_name in field_mapping.items():
            if field_name in df.columns:
                correlation_df[var_name] = pd.to_numeric(df[field_name], errors='coerce')
    else:
        # Create empty dataframe if no valid data
        correlation_df = pd.DataFrame({var: [] for var in ['佔床率', '手術人次', '醫師人數', '護理人數', '全院員工數',
                                                           '門診人次', '急診人次', '住院人次', '本月廢棄物總量',
                                                           '次月廢棄物總量']})

    variables = list(correlation_df.columns)
    correlations = {}

    for row_var in variables:
        correlations[row_var] = {}
        for col_var in variables:
            if len(correlation_df) > 0 and row_var in correlation_df.columns and col_var in correlation_df.columns:
                # Create data points for scatter plot, removing any NaN values
                valid_indices = correlation_df[[col_var, row_var]].dropna().index
                data_points = [{'x': float(correlation_df.loc[idx, col_var]),
                                'y': float(correlation_df.loc[idx, row_var])}
                               for idx in valid_indices]

                if len(data_points) >= 2:  # Need at least 2 points for correlation
                    x_vals = [p['x'] for p in data_points]
                    y_vals = [p['y'] for p in data_points]
                    r2_value = calculate_r2(x_vals, y_vals)
                    slope, intercept = calculate_regression(x_vals, y_vals)
                else:
                    r2_value = 0
                    slope = 0
                    intercept = 0
            else:
                data_points = []
                r2_value = 0
                slope = 0
                intercept = 0

            correlations[row_var][col_var] = {
                'points': data_points,
                'r2': r2_value,
                'slope': slope,
                'intercept': intercept
            }

    # Prepare context for template
    field_info = HospitalOperationalData.FIELD_INFO
    fields = list(field_info.keys())

    context = {
        'variables': variables,
        'correlations': correlations,
        'data': all_data,
        'field_info': field_info,
        'fields': fields,
        'selected_table': 'hospital_operational_data',
        'table_names': {
            'hospital_operational_data': '醫院營運數據'
        }
    }
    return render(request, 'prediction/prediction.html', context)


# Database Management Functions - Add permission decorators
@csrf_protect
@require_http_methods(["POST"])
@permission_required("registrar")  # Add permission decorator
def batch_import(request):
    """Handle batch import of prediction factors data using modular processing architecture."""
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "無效請求方法"})

    try:
        data = json.loads(request.body.decode('utf-8'))
        rows = data.get("rows", [])
        override_conflicts = data.get("override_conflicts", False)

        if not rows:
            return JsonResponse({"success": False, "error": "未提供資料"})

        # Security check: Verify override permission
        if override_conflicts:
            from MedicalWasteManagementSystem.permissions import has_override_permission
            if not has_override_permission(request.user, 'prediction'):
                logger.warning(f"User {request.user.username} attempted override without permission")
                return JsonResponse({"success": False, "error": "您沒有覆寫資料的權限"})

        # Prepare results container
        results = {
            "total": len(rows),
            "success": 0,
            "failed": [],
            "conflicts": []
        }

        # Pre-process to find all dates for bulk exists check
        all_dates = [row.get("date") for row in rows if validate_date_format(row.get("date"))]
        invalid_dates = [idx for idx, row in enumerate(rows) if not validate_date_format(row.get("date"))]

        # Mark invalid dates as failed
        for idx in invalid_dates:
            results["failed"].append({
                "index": idx,
                "reason": "日期格式無效",
                "data": rows[idx]
            })

        # Bulk check for existing records to reduce DB queries
        existing_dates = set()
        if all_dates:
            existing_dates = set(
                HospitalOperationalData.objects.filter(date__in=all_dates).values_list('date', flat=True))

        # Group rows for processing
        rows_to_update = []
        rows_to_create = []

        for idx, row in enumerate(rows):
            date = row.get("date")
            if not validate_date_format(date):
                continue  # Already marked as failed

            # Validate all required fields except medical_waste_total
            has_error = False
            for field, value in row.items():
                if field not in ['date', 'medical_waste_total'] and (not value or value.strip() == ''):
                    results["failed"].append({
                        "index": idx,
                        "reason": f"必填欄位 '{field}' 為空",
                        "data": row
                    })
                    has_error = True
                    break

            if has_error:
                continue

            if date in existing_dates:
                if override_conflicts:
                    rows_to_update.append((idx, row))
                else:
                    results["conflicts"].append({
                        "index": idx,
                        "date": date,
                        "data": row
                    })
            else:
                rows_to_create.append((idx, row))

        # Process creates and updates with optimized bulk operations
        if rows_to_create:
            batch_processor = BatchProcessor()
            created_count = batch_processor.process_batch_create(HospitalOperationalData, rows_to_create, True)
            results["success"] += created_count

        if rows_to_update:
            updated_count = process_batch_update(rows_to_update, results)
            results["success"] += updated_count

        # Check if we have unresolved conflicts
        if results["conflicts"] and not override_conflicts:
            return JsonResponse({
                "success": False,
                "error": "資料衝突",
                "results": results
            })

        return JsonResponse({"success": True, "results": results})

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "無效的 JSON 資料"})
    except Exception as e:
        logger.error(f"批次匯入錯誤: {str(e)}", exc_info=True)
        return JsonResponse({"success": False, "error": f"伺服器錯誤: {str(e)}"})


# process_batch_create function moved to MedicalWasteManagementSystem.utils.BatchProcessor


def process_batch_update(rows_to_update, results):
    """Process batch updates with optimized handling."""
    # For updates, process one by one to ensure success
    success_count = 0

    for idx, row in rows_to_update:
        date = row.get('date')

        try:
            # Validate fields
            validated_data = validate_and_convert_fields(row)
            if validated_data.get('error'):
                results["failed"].append({
                    "index": idx,
                    "reason": validated_data['error'],
                    "data": row
                })
                continue

            # Apply update with retry logic
            success = False
            retry_count = 0
            max_retries = 3

            while not success and retry_count < max_retries:
                try:
                    # Use separate, discrete transactions for each operation
                    # First, delete the existing record
                    with transaction.atomic():
                        HospitalOperationalData.objects.filter(date=date).delete()

                    # Then create a new record
                    with transaction.atomic():
                        HospitalOperationalData.objects.create(**validated_data)

                    success = True
                    success_count += 1
                except OperationalError as e:
                    if "database is locked" in str(e) and retry_count < max_retries - 1:
                        connections.close_all()
                        retry_count += 1
                        delay = 0.2 * (2 ** retry_count)  # Exponential backoff
                        time.sleep(delay)
                        logger.warning(f"資料庫鎖定，正在重試更新第 {idx} 列 (第 {retry_count} 次)")
                    else:
                        results["failed"].append({
                            "index": idx,
                            "reason": f"資料庫鎖定錯誤: {str(e)}",
                            "data": row
                        })
                        break
                except Exception as e:
                    results["failed"].append({
                        "index": idx,
                        "reason": f"更新錯誤: {str(e)}",
                        "data": row
                    })
                    break
        except Exception as e:
            results["failed"].append({
                "index": idx,
                "reason": f"處理資料錯誤: {str(e)}",
                "data": row
            })

    return success_count


def validate_and_convert_fields(row_data):
    """Validate and convert data fields to appropriate types with business rules."""
    result = {'date': row_data.get('date')}

    try:
        # Validate bed occupancy rate (percent)
        if 'bed_occupancy_rate' in row_data:
            value = row_data['bed_occupancy_rate'].strip()
            if value:
                value = float(value)
                if value < 0 or value > 100:
                    return {'error': '佔床率必須在 0 至 100 之間'}
                result['bed_occupancy_rate'] = value

        # Validate integer fields (must be non-negative integers)
        integer_fields = ['surgical_cases', 'doctor_count', 'nurse_count',
                          'total_staff_count', 'outpatient_visits',
                          'emergency_visits', 'inpatient_visits']

        for field in integer_fields:
            if field in row_data:
                value = row_data[field].strip()
                if value:
                    value = float(value)
                    if value < 0 or not value.is_integer():
                        return {'error': f'{field} 必須為非負整數'}
                    result[field] = int(value)

        # Handle medical waste total (can be null)
        if 'medical_waste_total' in row_data and row_data['medical_waste_total'].strip():
            value = float(row_data['medical_waste_total'])
            if value < 0:
                return {'error': '廢棄物總量不能為負數'}
            result['medical_waste_total'] = value

        return result
    except ValueError:
        return {'error': '資料中有無效的數值'}


# validate_date_format function moved to MedicalWasteManagementSystem.utils


# Database Management Functions - Add permission decorators
@csrf_protect
@require_http_methods(["POST"])
@permission_required("registrar")  # Add permission decorator
def save_data(request):
    """Save hospital operational data"""
    try:
        data = json.loads(request.body)
        date = data.get('date')
        original_date = data.get('original_date', '')

        if not date:
            return JsonResponse({'success': False, 'error': '日期為必填欄位'})

        with transaction.atomic():
            if original_date:
                # Update existing record
                obj = HospitalOperationalData.objects.select_for_update().get(date=original_date)
                obj.date = date
            else:
                # Check if date already exists
                if HospitalOperationalData.objects.filter(date=date).exists():
                    return JsonResponse({'success': False, 'error': f'{date} 的資料已存在'})
                # Create new record
                obj = HospitalOperationalData(date=date)

            # Update fields
            for field in HospitalOperationalData.FIELD_INFO.keys():
                if field in data:
                    value = data[field]
                    if value == '':
                        value = None
                    elif field == 'bed_occupancy_rate' and value is not None:
                        value = float(value)
                    elif field in ['surgical_cases', 'doctor_count', 'nurse_count',
                                   'total_staff_count', 'outpatient_visits', 'emergency_visits',
                                   'inpatient_visits'] and value is not None:
                        value = int(value)
                    elif field == 'medical_waste_total' and value is not None:
                        value = float(value)
                    setattr(obj, field, value)

            obj.save()

        return JsonResponse({'success': True})

    except HospitalOperationalData.DoesNotExist:
        return JsonResponse({'success': False, 'error': f'找不到日期為 {original_date} 的資料'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@csrf_protect
@require_http_methods(["POST"])
@permission_required("registrar")  # Add permission decorator
def delete_data(request):
    """Delete hospital operational data"""
    try:
        data = json.loads(request.body)
        dates = data.get('dates', [])

        if not dates:
            return JsonResponse({'success': False, 'error': '未選擇要刪除的日期'})

        deleted_count = HospitalOperationalData.objects.filter(date__in=dates).delete()[0]

        return JsonResponse({'success': True, 'deleted_count': deleted_count})

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@require_http_methods(["GET"])
@permission_required("registrar")  # Add permission decorator
def get_data(request):
    """Get hospital operational data for a specific date"""
    try:
        date = request.GET.get('date')
        if not date:
            return JsonResponse({'error': '未提供日期'}, status=400)

        obj = HospitalOperationalData.objects.get(date=date)
        data = {'date': obj.date}

        for field in HospitalOperationalData.FIELD_INFO.keys():
            data[field] = getattr(obj, field)

        return JsonResponse(data)

    except HospitalOperationalData.DoesNotExist:
        return JsonResponse({'error': f'找不到日期為 {date} 的資料'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)