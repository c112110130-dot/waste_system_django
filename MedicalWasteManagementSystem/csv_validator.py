"""
Unified CSV Validation System
Provides consistent CSV validation rules that match frontend validation exactly
Used across all import functionality (WasteManagement, WasteTransportation, WastePrediction)
"""
import csv
import io
import re
from typing import Dict, List, Optional, Tuple, Union, Any
from decimal import Decimal, InvalidOperation
import logging

logger = logging.getLogger(__name__)


class CSVTypes:
    """Enumeration of supported CSV types"""
    DEPARTMENT_WASTE = 'department_waste'
    TRANSPORTATION = 'transportation'
    PREDICTION = 'prediction'


class ValidationRules:
    """Validation rules that match frontend exactly"""
    DATE_FORMAT = {
        'pattern': r'^\d{4}-(0[1-9]|1[0-2])$',  # YYYY-MM format
        'min_year': 1970,
        'max_year': 9999
    }
    
    AMOUNT = {
        'min': 0,
        'max_precision': 2
    }
    
    FILE_SIZE = {
        'max_size': 5 * 1024 * 1024,  # 5MB
        'max_rows': 10000
    }
    
    ENCODING = {
        'supported': ['utf-8', 'utf-8-sig', 'big5', 'gb2312']
    }


class ErrorMessages:
    """Error messages that match frontend messages"""
    EMPTY_FILE = 'CSV檔案為空'
    INVALID_FORMAT = 'CSV格式錯誤'
    MISSING_DATE_COLUMN = 'CSV檔案必須包含「日期」欄位'
    INVALID_DATE_FORMAT = '日期格式錯誤，請使用YYYY-MM格式'
    INVALID_AMOUNT = '數量格式錯誤或為負數'
    UNKNOWN_DEPARTMENTS = '未知部門'
    DUPLICATE_COLUMNS = '重複欄位'
    FILE_TOO_LARGE = '檔案過大，請分割後上傳'
    TOO_MANY_ROWS = '資料行數過多，請分割後上傳'
    ENCODING_ERROR = '檔案編碼不支援，請使用UTF-8格式'


class ValidationResult:
    """Validation result container"""
    def __init__(self, valid: bool, error: str = None, data: Any = None, 
                 warnings: List[str] = None, details: Dict = None):
        self.valid = valid
        self.error = error
        self.data = data or {}
        self.warnings = warnings or []
        self.details = details or {}
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        result = {
            'valid': self.valid,
            'data': self.data,
            'warnings': self.warnings
        }
        
        if self.error:
            result['error'] = self.error
        
        if self.details:
            result['details'] = self.details
            
        return result


class CSVValidator:
    """Main CSV Validator class that matches frontend validation exactly"""
    
    def __init__(self, csv_type: str = CSVTypes.DEPARTMENT_WASTE):
        self.csv_type = csv_type
        self.validation_errors: List[str] = []
        self.validation_warnings: List[str] = []
    
    def validate(self, csv_content: Union[str, bytes], options: Dict = None) -> ValidationResult:
        """
        Validate complete CSV content
        
        Args:
            csv_content: CSV content as string or bytes
            options: Validation options dictionary
            
        Returns:
            ValidationResult object with validation results
        """
        options = options or {}
        self.clear_errors()
        
        try:
            # Handle bytes input
            if isinstance(csv_content, bytes):
                csv_content = self._decode_content(csv_content)
            
            # Parse CSV content
            parse_result = self._parse_csv(csv_content)
            if not parse_result.valid:
                return parse_result
            
            headers, rows = parse_result.data['headers'], parse_result.data['rows']
            
            # Validate structure
            structure_validation = self._validate_structure(headers, options)
            if not structure_validation.valid:
                return structure_validation
            
            # Validate data rows
            data_validation = self._validate_data_rows(headers, rows, options)
            if not data_validation.valid:
                return data_validation
            
            return ValidationResult(
                valid=True,
                data={
                    'headers': headers,
                    'rows': rows,
                    'valid_rows': data_validation.data['valid_rows'],
                    'stats': {
                        'total_rows': len(rows),
                        'valid_rows': len(data_validation.data['valid_rows']),
                        'invalid_rows': len(rows) - len(data_validation.data['valid_rows'])
                    }
                },
                warnings=self.validation_warnings
            )
            
        except Exception as e:
            logger.error(f"CSV validation error: {str(e)}")
            return ValidationResult(
                valid=False,
                error=f"{ErrorMessages.INVALID_FORMAT}: {str(e)}",
                details={'original_error': str(e)}
            )
    
    def _decode_content(self, content: bytes) -> str:
        """Decode bytes content with encoding detection"""
        # Try different encodings
        encodings = ['utf-8-sig', 'utf-8', 'big5', 'gb2312']
        
        for encoding in encodings:
            try:
                return content.decode(encoding)
            except UnicodeDecodeError:
                continue
        
        raise ValueError(ErrorMessages.ENCODING_ERROR)
    
    def _parse_csv(self, content: str) -> ValidationResult:
        """Parse CSV content into headers and rows"""
        if not content or content.strip() == '':
            return ValidationResult(
                valid=False,
                error=ErrorMessages.EMPTY_FILE
            )
        
        try:
            # Use Python's csv module for reliable parsing
            csv_reader = csv.reader(io.StringIO(content))
            lines = list(csv_reader)
            
            if not lines:
                return ValidationResult(
                    valid=False,
                    error=ErrorMessages.EMPTY_FILE
                )
            
            headers = [h.strip() for h in lines[0]]
            rows = [[cell.strip() for cell in line] for line in lines[1:]]
            
            # Check for too many rows
            if len(rows) > ValidationRules.FILE_SIZE['max_rows']:
                return ValidationResult(
                    valid=False,
                    error=ErrorMessages.TOO_MANY_ROWS,
                    details={
                        'row_count': len(rows),
                        'max_rows': ValidationRules.FILE_SIZE['max_rows']
                    }
                )
            
            return ValidationResult(
                valid=True,
                data={'headers': headers, 'rows': rows}
            )
            
        except Exception as e:
            return ValidationResult(
                valid=False,
                error=f"{ErrorMessages.INVALID_FORMAT}: {str(e)}"
            )
    
    def _validate_structure(self, headers: List[str], options: Dict) -> ValidationResult:
        """Validate CSV structure (headers)"""
        # Check for empty headers
        if not headers:
            return ValidationResult(
                valid=False,
                error=ErrorMessages.EMPTY_FILE
            )
        
        # Check for duplicate columns
        duplicates = [h for h in headers if headers.count(h) > 1]
        if duplicates:
            unique_duplicates = list(set(duplicates))
            return ValidationResult(
                valid=False,
                error=f"{ErrorMessages.DUPLICATE_COLUMNS}: {', '.join(unique_duplicates)}"
            )
        
        # Type-specific validation
        if self.csv_type == CSVTypes.DEPARTMENT_WASTE:
            return self._validate_department_waste_structure(headers, options)
        elif self.csv_type == CSVTypes.TRANSPORTATION:
            return self._validate_transportation_structure(headers, options)
        elif self.csv_type == CSVTypes.PREDICTION:
            return self._validate_prediction_structure(headers, options)
        
        return ValidationResult(valid=True)
    
    def _validate_department_waste_structure(self, headers: List[str], options: Dict) -> ValidationResult:
        """Validate department waste CSV structure"""
        # Must have date column
        if '日期' not in headers:
            return ValidationResult(
                valid=False,
                error=ErrorMessages.MISSING_DATE_COLUMN
            )
        
        # Validate department names if provided
        valid_departments = options.get('valid_departments', [])
        if valid_departments:
            department_headers = [h for h in headers if h != '日期']
            unknown_departments = [h for h in department_headers if h not in valid_departments]
            
            if unknown_departments:
                return ValidationResult(
                    valid=False,
                    error=f"{ErrorMessages.UNKNOWN_DEPARTMENTS}: {', '.join(unknown_departments)}"
                )
        
        return ValidationResult(valid=True)
    
    def _validate_transportation_structure(self, headers: List[str], options: Dict) -> ValidationResult:
        """Validate transportation CSV structure"""
        required_columns = ['聯單編號', '廢棄物名稱', '事業機構']
        missing_columns = [col for col in required_columns if col not in headers]
        
        if missing_columns:
            return ValidationResult(
                valid=False,
                error=f"缺少必要欄位: {', '.join(missing_columns)}"
            )
        
        return ValidationResult(valid=True)
    
    def _validate_prediction_structure(self, headers: List[str], options: Dict) -> ValidationResult:
        """Validate prediction CSV structure"""
        required_columns = ['日期', '因子']
        missing_columns = [col for col in required_columns if col not in headers]
        
        if missing_columns:
            return ValidationResult(
                valid=False,
                error=f"缺少必要欄位: {', '.join(missing_columns)}"
            )
        
        return ValidationResult(valid=True)
    
    def _validate_data_rows(self, headers: List[str], rows: List[List[str]], options: Dict) -> ValidationResult:
        """Validate data rows"""
        valid_rows = []
        errors = []
        
        for row_index, row in enumerate(rows):
            row_validation = self._validate_single_row(headers, row, row_index + 2)  # +2 for 1-based + header
            
            if row_validation.valid:
                valid_rows.append(row_validation.data)
            else:
                errors.append({
                    'row': row_index + 2,
                    'error': row_validation.error,
                    'details': row_validation.details
                })
        
        # If too many errors, fail validation
        error_threshold = max(10, len(rows) // 10)  # 10% or minimum 10
        if len(errors) > error_threshold:
            return ValidationResult(
                valid=False,
                error=f"資料錯誤過多 ({len(errors)} 行錯誤)，請檢查檔案格式",
                details={'errors': errors[:10]}  # Show first 10 errors
            )
        
        # If some errors but below threshold, add as warnings
        if errors:
            self.add_warning(f"忽略了 {len(errors)} 行錯誤資料")
        
        return ValidationResult(
            valid=True,
            data={'valid_rows': valid_rows}
        )
    
    def _validate_single_row(self, headers: List[str], row: List[str], row_number: int) -> ValidationResult:
        """Validate a single data row"""
        # Skip empty rows
        if not row or all(not cell or cell.strip() == '' for cell in row):
            return ValidationResult(valid=False, error='空白行')
        
        # Check column count
        if len(row) != len(headers):
            self.add_warning(f"第 {row_number} 行欄位數量不匹配")
        
        row_data = {}
        errors = []
        
        for i, header in enumerate(headers):
            value = row[i] if i < len(row) else ''
            validation = self._validate_cell_value(header, value, row_number)
            
            if validation.valid:
                row_data[header] = validation.data
            else:
                errors.append(f"{header}: {validation.error}")
        
        if errors:
            return ValidationResult(
                valid=False,
                error=', '.join(errors),
                details={'errors': errors}
            )
        
        return ValidationResult(valid=True, data=row_data)
    
    def _validate_cell_value(self, header: str, value: str, row_number: int) -> ValidationResult:
        """Validate individual cell value"""
        trimmed_value = value.strip() if value else ''
        
        # Handle empty values
        if not trimmed_value:
            if header == '日期':
                return ValidationResult(valid=False, error='日期不能為空')
            return ValidationResult(valid=True, data=None)
        
        # Date validation
        if header == '日期':
            return self._validate_date_value(trimmed_value)
        
        # Amount validation (for non-date columns)
        if header != '日期':
            return self._validate_amount_value(trimmed_value)
        
        return ValidationResult(valid=True, data=trimmed_value)
    
    def _validate_date_value(self, date_str: str) -> ValidationResult:
        """Validate date value (matches frontend validation exactly)"""
        # Check format pattern
        if not re.match(ValidationRules.DATE_FORMAT['pattern'], date_str):
            return ValidationResult(
                valid=False,
                error=ErrorMessages.INVALID_DATE_FORMAT
            )
        
        try:
            year_str, month_str = date_str.split('-')
            year = int(year_str)
            month = int(month_str)
            
            if (year < ValidationRules.DATE_FORMAT['min_year'] or 
                year > ValidationRules.DATE_FORMAT['max_year'] or
                month < 1 or month > 12):
                return ValidationResult(
                    valid=False,
                    error=ErrorMessages.INVALID_DATE_FORMAT
                )
            
            return ValidationResult(valid=True, data=date_str)
            
        except (ValueError, TypeError):
            return ValidationResult(
                valid=False,
                error=ErrorMessages.INVALID_DATE_FORMAT
            )
    
    def _validate_amount_value(self, amount_str: str) -> ValidationResult:
        """Validate amount value (matches frontend validation exactly)"""
        try:
            amount = Decimal(amount_str)
            
            if amount < ValidationRules.AMOUNT['min']:
                return ValidationResult(
                    valid=False,
                    error=ErrorMessages.INVALID_AMOUNT
                )
            
            return ValidationResult(valid=True, data=float(amount))
            
        except (ValueError, InvalidOperation):
            return ValidationResult(
                valid=False,
                error='無效的數字格式'
            )
    
    def clear_errors(self):
        """Clear validation errors and warnings"""
        self.validation_errors = []
        self.validation_warnings = []
    
    def add_warning(self, message: str):
        """Add validation warning"""
        self.validation_warnings.append(message)
    
    def add_error(self, message: str):
        """Add validation error"""
        self.validation_errors.append(message)


# Convenience factory functions
def create_department_validator() -> CSVValidator:
    """Create validator for department waste CSV"""
    return CSVValidator(CSVTypes.DEPARTMENT_WASTE)


def create_transportation_validator() -> CSVValidator:
    """Create validator for transportation CSV"""
    return CSVValidator(CSVTypes.TRANSPORTATION)


def create_prediction_validator() -> CSVValidator:
    """Create validator for prediction CSV"""
    return CSVValidator(CSVTypes.PREDICTION)


# Quick validation functions
def validate_department_csv(csv_content: Union[str, bytes], valid_departments: List[str] = None) -> ValidationResult:
    """Quick validation for department waste CSV"""
    validator = CSVValidator(CSVTypes.DEPARTMENT_WASTE)
    options = {'valid_departments': valid_departments} if valid_departments else {}
    return validator.validate(csv_content, options)


def validate_transportation_csv(csv_content: Union[str, bytes], options: Dict = None) -> ValidationResult:
    """Quick validation for transportation CSV"""
    validator = CSVValidator(CSVTypes.TRANSPORTATION)
    return validator.validate(csv_content, options or {})


def validate_prediction_csv(csv_content: Union[str, bytes], options: Dict = None) -> ValidationResult:
    """Quick validation for prediction CSV"""
    validator = CSVValidator(CSVTypes.PREDICTION)
    return validator.validate(csv_content, options or {})


# Validation API endpoint helpers
def validate_csv_api(csv_content: Union[str, bytes], csv_type: str, options: Dict = None) -> Dict:
    """
    API helper function for CSV validation
    Returns JSON-serializable dictionary
    """
    try:
        validator = CSVValidator(csv_type)
        result = validator.validate(csv_content, options or {})
        return result.to_dict()
    except Exception as e:
        logger.error(f"CSV validation API error: {str(e)}")
        return {
            'valid': False,
            'error': f"{ErrorMessages.INVALID_FORMAT}: {str(e)}",
            'details': {'original_error': str(e)}
        }