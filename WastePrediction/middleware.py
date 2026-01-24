"""
WastePrediction Middleware
Imports shared middleware to avoid code duplication
"""
from MedicalWasteManagementSystem.shared_middleware import DatabaseOptimizationMiddleware, reset_db_connection

# Re-export for backward compatibility
__all__ = ['DatabaseOptimizationMiddleware', 'reset_db_connection']