"""
Response Formatter - Standardizes API response formats across all modules
Ensures consistent frontend-backend integration
"""
from django.http import JsonResponse
from typing import Any, Dict, Optional, Union


class ResponseFormatter:
    """Standardized API response formatter for consistent frontend integration"""
    
    @staticmethod
    def success_response(data: Any = None, message: str = '', **kwargs) -> JsonResponse:
        """
        Create a successful response
        
        Args:
            data: Response data
            message: Success message
            **kwargs: Additional fields to include in response
            
        Returns:
            JsonResponse with standardized success format
        """
        response_data = {
            'success': True,
            'message': message
        }
        
        if data is not None:
            response_data['data'] = data
            
        # Add any additional fields directly to the response
        response_data.update(kwargs)
        
        return JsonResponse(response_data)
    
    @staticmethod
    def error_response(error: str, details: Any = None, status: int = 400) -> JsonResponse:
        """
        Create an error response
        
        Args:
            error: Error message
            details: Additional error details
            status: HTTP status code
            
        Returns:
            JsonResponse with standardized error format
        """
        response_data = {
            'success': False,
            'error': error
        }
        
        if details is not None:
            response_data['details'] = details
            
        return JsonResponse(response_data, status=status)
    
    @staticmethod
    def validation_error(errors: Dict[str, Any]) -> JsonResponse:
        """
        Create a validation error response
        
        Args:
            errors: Dictionary of validation errors
            
        Returns:
            JsonResponse with validation error format
        """
        return JsonResponse({
            'success': False,
            'error': '資料驗證失敗',
            'validation_errors': errors
        }, status=400)
    
    @staticmethod
    def batch_response(results: Dict[str, Any]) -> JsonResponse:
        """
        Create a batch operation response
        
        Args:
            results: Batch operation results
            
        Returns:
            JsonResponse with batch operation format
        """
        success = results.get('conflicts', []) == [] and results.get('failed', []) == []
        
        response_data = {
            'success': success,
            'results': results
        }
        
        if not success and results.get('conflicts'):
            response_data['error'] = '資料衝突'
            
        return JsonResponse(response_data)
    
    @staticmethod
    def list_response(items: list, total_count: int = None, **pagination_info) -> JsonResponse:
        """
        Create a list response with pagination info
        
        Args:
            items: List of items
            total_count: Total count of items
            **pagination_info: Additional pagination information
            
        Returns:
            JsonResponse with list format
        """
        response_data = {
            'success': True,
            'data': items,
            'count': len(items)
        }
        
        if total_count is not None:
            response_data['totalCount'] = total_count
            
        response_data.update(pagination_info)
        
        return JsonResponse(response_data)