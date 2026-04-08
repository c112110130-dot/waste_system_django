"""
Unified Date Validation System
Standardizes YYYY-MM date format validation across frontend and backend
All database operations use YYYY-MM format (Year-Month) for monthly tracking
"""
import re
from datetime import datetime
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class DateFormatStandards:
    """Standard date formats used throughout the system"""
    # Primary format for database storage: YYYY-MM (Year-Month only)
    DATABASE_FORMAT = "%Y-%m"
    DATABASE_PATTERN = r'^\d{4}-(0[1-9]|1[0-2])$'
    
    # Input formats for user interfaces
    INPUT_FORMAT = "YYYY-MM"
    
    # Validation constraints
    MIN_YEAR = 1970
    MAX_YEAR = 9999
    MIN_MONTH = 1
    MAX_MONTH = 12
    
    # Error messages
    INVALID_FORMAT_MSG = "日期格式錯誤，請使用YYYY-MM格式"
    INVALID_YEAR_MSG = f"年份必須在{MIN_YEAR}-{MAX_YEAR}之間"
    INVALID_MONTH_MSG = f"月份必須在{MIN_MONTH:02d}-{MAX_MONTH:02d}之間"
    EMPTY_DATE_MSG = "日期不能為空"


def validate_yyyy_mm_format(date_str: str) -> Tuple[bool, str]:
    """
    Validate YYYY-MM date format (primary database format)
    
    Args:
        date_str: Date string to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not date_str or not isinstance(date_str, str):
        return False, DateFormatStandards.EMPTY_DATE_MSG
    
    date_str = date_str.strip()
    
    # Check basic format pattern
    if not re.match(DateFormatStandards.DATABASE_PATTERN, date_str):
        return False, DateFormatStandards.INVALID_FORMAT_MSG
    
    try:
        # Parse and validate date components
        year_str, month_str = date_str.split('-')
        year = int(year_str)
        month = int(month_str)
        
        # Validate year range
        if year < DateFormatStandards.MIN_YEAR or year > DateFormatStandards.MAX_YEAR:
            return False, DateFormatStandards.INVALID_YEAR_MSG
        
        # Validate month range
        if month < DateFormatStandards.MIN_MONTH or month > DateFormatStandards.MAX_MONTH:
            return False, DateFormatStandards.INVALID_MONTH_MSG
        
        # Verify using datetime parsing
        datetime.strptime(date_str, DateFormatStandards.DATABASE_FORMAT)
        
        return True, ""
        
    except (ValueError, TypeError) as e:
        logger.debug(f"Date validation error for '{date_str}': {e}")
        return False, DateFormatStandards.INVALID_FORMAT_MSG


def normalize_yyyy_mm_date(date_str: str) -> Optional[str]:
    """
    Normalize date string to standard YYYY-MM format
    
    Args:
        date_str: Input date string
        
    Returns:
        Normalized YYYY-MM string or None if invalid
    """
    is_valid, error_msg = validate_yyyy_mm_format(date_str)
    if not is_valid:
        return None
    
    try:
        # Parse and reformat to ensure consistent formatting
        date_obj = datetime.strptime(date_str.strip(), DateFormatStandards.DATABASE_FORMAT)
        return date_obj.strftime(DateFormatStandards.DATABASE_FORMAT)
    except ValueError:
        return None


def get_current_yyyy_mm() -> str:
    """
    Get current date in YYYY-MM format
    
    Returns:
        Current date as YYYY-MM string
    """
    return datetime.now().strftime(DateFormatStandards.DATABASE_FORMAT)


def compare_yyyy_mm_dates(date1: str, date2: str) -> int:
    """
    Compare two YYYY-MM dates
    
    Args:
        date1: First date string
        date2: Second date string
        
    Returns:
        -1 if date1 < date2, 0 if equal, 1 if date1 > date2
        Returns 0 if either date is invalid
    """
    try:
        is_valid1, _ = validate_yyyy_mm_format(date1)
        is_valid2, _ = validate_yyyy_mm_format(date2)
        
        if not is_valid1 or not is_valid2:
            return 0
        
        if date1 < date2:
            return -1
        elif date1 > date2:
            return 1
        else:
            return 0
            
    except Exception:
        return 0


def generate_month_range(start_date: str, end_date: str) -> list[str]:
    """
    Generate list of YYYY-MM dates between start and end (inclusive)
    
    Args:
        start_date: Start date in YYYY-MM format
        end_date: End date in YYYY-MM format
        
    Returns:
        List of YYYY-MM date strings
    """
    try:
        is_valid_start, _ = validate_yyyy_mm_format(start_date)
        is_valid_end, _ = validate_yyyy_mm_format(end_date)
        
        if not is_valid_start or not is_valid_end:
            return []
        
        start_obj = datetime.strptime(start_date, DateFormatStandards.DATABASE_FORMAT)
        end_obj = datetime.strptime(end_date, DateFormatStandards.DATABASE_FORMAT)
        
        if start_obj > end_obj:
            return []
        
        months = []
        current = start_obj
        
        while current <= end_obj:
            months.append(current.strftime(DateFormatStandards.DATABASE_FORMAT))
            
            # Move to next month
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
        
        return months
        
    except Exception as e:
        logger.error(f"Error generating month range: {e}")
        return []


# Legacy function compatibility (used by existing code)
def validate_date_format(date_str: str, date_format: str = "%Y-%m") -> bool:
    """
    Legacy compatibility function for existing code
    
    Args:
        date_str: Date string to validate
        date_format: Format string (defaults to %Y-%m for YYYY-MM)
        
    Returns:
        True if valid, False otherwise
    """
    if date_format == "%Y-%m" or date_format == "YYYY-MM":
        is_valid, _ = validate_yyyy_mm_format(date_str)
        return is_valid
    
    # For other formats, use original datetime parsing
    if not date_str:
        return False
    
    try:
        datetime.strptime(date_str, date_format)
        return True
    except (ValueError, TypeError):
        return False


# API response helpers
def create_date_validation_error(date_str: str) -> dict:
    """
    Create standardized error response for date validation failures
    
    Args:
        date_str: The invalid date string
        
    Returns:
        Dictionary with error details
    """
    is_valid, error_msg = validate_yyyy_mm_format(date_str)
    
    return {
        'success': False,
        'error': error_msg,
        'error_code': 'INVALID_DATE_FORMAT',
        'details': {
            'input_date': date_str,
            'expected_format': DateFormatStandards.INPUT_FORMAT,
            'example': get_current_yyyy_mm()
        }
    }