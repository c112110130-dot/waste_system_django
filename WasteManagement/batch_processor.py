"""
Batch processing utilities for WasteManagement module.
Extracted from monolithic views to improve maintainability and testability.
"""
import logging
from typing import Dict, List, Tuple, Any, Optional
from datetime import datetime
from django.db import transaction
from django.db.models import Model

from MedicalWasteManagementSystem.date_validators import validate_date_format
from MedicalWasteManagementSystem.shared_utils import BatchProcessor, TransactionManager

logger = logging.getLogger(__name__)


class WasteDataValidator:
    """Validates waste management data for batch operations."""
    
    @staticmethod
    def validate_row_data(row: Dict[str, Any], fields: List[str]) -> Tuple[Dict[str, Any], List[str]]:
        """
        Validate a single row of waste data.
        
        Args:
            row: Raw row data
            fields: Expected field names
            
        Returns:
            tuple: (cleaned_data, validation_errors)
        """
        errors = []
        cleaned_data = {}
        
        # Validate date
        date_value = row.get("date")
        if not validate_date_format(date_value):
            errors.append("日期格式無效")
            return cleaned_data, errors
        
        cleaned_data["date"] = date_value
        
        # Validate and clean numeric fields
        for field in fields:
            if field == "date":
                continue
                
            value = row.get(field, "")
            if value == "" or value is None:
                cleaned_data[field] = None
            else:
                try:
                    # Convert to float for numeric validation
                    numeric_value = float(value)
                    if numeric_value < 0:
                        errors.append(f"{field} 不能為負數")
                    else:
                        cleaned_data[field] = numeric_value
                except (ValueError, TypeError):
                    errors.append(f"{field} 數值格式無效")
        
        return cleaned_data, errors


class WasteDataConflictManager:
    """Manages conflicts in waste data batch operations."""
    
    def __init__(self, model: Model):
        self.model = model
    
    def check_conflicts(self, dates: List[str]) -> set:
        """
        Check for existing records that would conflict.
        
        Args:
            dates: List of dates to check
            
        Returns:
            set: Set of dates that already exist
        """
        if not dates:
            return set()
        
        try:
            existing_dates = self.model.objects.filter(
                date__in=dates
            ).values_list('date', flat=True)
            return set(existing_dates)
        except Exception as e:
            logger.error(f"Error checking conflicts: {e}")
            return set()
    
    def categorize_rows(
        self, 
        rows: List[Dict[str, Any]], 
        existing_dates: set, 
        override_conflicts: bool = False
    ) -> Tuple[List[Tuple[int, Dict]], List[Tuple[int, Dict]], List[int]]:
        """
        Categorize rows into create, update, and conflict groups.
        
        Args:
            rows: List of validated row data
            existing_dates: Set of existing dates
            override_conflicts: Whether to override conflicts
            
        Returns:
            tuple: (rows_to_create, rows_to_update, conflict_indices)
        """
        rows_to_create = []
        rows_to_update = []
        conflict_indices = []
        
        for idx, row in enumerate(rows):
            date = row.get("date")
            
            if date in existing_dates:
                if override_conflicts:
                    rows_to_update.append((idx, row))
                else:
                    conflict_indices.append(idx)
            else:
                rows_to_create.append((idx, row))
        
        return rows_to_create, rows_to_update, conflict_indices


class WasteBatchProcessor:
    """Main processor for waste management batch operations."""
    
    def __init__(self, model: Model, fields: List[str]):
        self.model = model
        self.fields = fields
        self.validator = WasteDataValidator()
        self.conflict_manager = WasteDataConflictManager(model)
        self.batch_processor = BatchProcessor()
    
    def process_batch_import(
        self, 
        rows: List[Dict[str, Any]], 
        override_conflicts: bool = False
    ) -> Dict[str, Any]:
        """
        Process batch import of waste data.
        
        Args:
            rows: List of raw row data
            override_conflicts: Whether to override existing records
            
        Returns:
            dict: Processing results
        """
        self.batch_processor.initialize_results(len(rows))
        
        # Step 1: Validate all rows
        validated_rows = []
        for idx, row in enumerate(rows):
            cleaned_data, errors = self.validator.validate_row_data(row, self.fields)
            
            if errors:
                self.batch_processor.add_failure(idx, "; ".join(errors))
                continue
            
            validated_rows.append((idx, cleaned_data))
        
        if not validated_rows:
            return self.batch_processor.get_results()
        
        # Step 2: Check for conflicts
        dates_to_check = [row[1]["date"] for row in validated_rows]
        existing_dates = self.conflict_manager.check_conflicts(dates_to_check)
        
        # Step 3: Categorize rows
        rows_to_create, rows_to_update, conflict_indices = self.conflict_manager.categorize_rows(
            [row[1] for row in validated_rows],
            existing_dates,
            override_conflicts
        )
        
        # Handle conflicts
        for original_idx in conflict_indices:
            # Find the original index in the validated rows
            for validated_idx, (orig_idx, _) in enumerate(validated_rows):
                if orig_idx == original_idx:
                    row_data = validated_rows[validated_idx][1]
                    self.batch_processor.add_conflict(
                        original_idx,
                        row_data.get("date", ""),
                        "資料已存在"
                    )
                    break
        
        # Step 4: Process creates and updates
        if rows_to_create:
            create_success = self._process_creates(rows_to_create)
            self.batch_processor.results["success"] += create_success
        
        if rows_to_update:
            update_success = self._process_updates(rows_to_update)
            self.batch_processor.results["success"] += update_success
        
        return self.batch_processor.get_results()
    
    def _process_creates(self, rows_to_create: List[Tuple[int, Dict]]) -> int:
        """Process row creation in batch."""
        success_count = 0
        
        try:
            with transaction.atomic():
                objects_to_create = []
                
                for idx, row_data in rows_to_create:
                    try:
                        obj = self.model(**row_data)
                        objects_to_create.append(obj)
                    except Exception as e:
                        logger.error(f"Error preparing object for row {idx}: {e}")
                        self.batch_processor.add_failure(idx, f"資料準備錯誤: {str(e)}")
                
                if objects_to_create:
                    created_objects = self.model.objects.bulk_create(
                        objects_to_create,
                        ignore_conflicts=False
                    )
                    success_count = len(created_objects)
                    
        except Exception as e:
            logger.error(f"Batch create error: {e}")
            # Mark all as failed
            for idx, _ in rows_to_create:
                self.batch_processor.add_failure(idx, f"批次建立失敗: {str(e)}")
        
        return success_count
    
    def _process_updates(self, rows_to_update: List[Tuple[int, Dict]]) -> int:
        """Process row updates individually."""
        success_count = 0
        
        for idx, row_data in rows_to_update:
            try:
                with transaction.atomic():
                    date = row_data.pop("date")  # Remove date from update data
                    
                    updated_count = self.model.objects.filter(
                        date=date
                    ).update(**row_data)
                    
                    if updated_count > 0:
                        success_count += 1
                    else:
                        self.batch_processor.add_failure(idx, "找不到要更新的記錄")
                        
            except Exception as e:
                logger.error(f"Error updating row {idx}: {e}")
                self.batch_processor.add_failure(idx, f"更新失敗: {str(e)}")
        
        return success_count


class WasteDataService:
    """Service layer for waste data operations."""
    
    @staticmethod
    def get_model_info(table_name: str) -> Tuple[Optional[Model], List[str], Optional[Dict]]:
        """
        Get model information for a table.
        
        Args:
            table_name: Name of the table
            
        Returns:
            tuple: (model_class, field_list, field_info_dict)
        """
        from WasteManagement.models import (
            GeneralWasteProduction,
            BiomedicalWasteProduction,
            DialysisBucketSoftBagProductionAndDisposalCosts,
            PharmaceuticalGlassProductionAndDisposalCosts,
            PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenue
        )
        
        TABLE_MAPPING = {
            "general_waste_production": GeneralWasteProduction,
            "biomedical_waste_production": BiomedicalWasteProduction,
            "dialysis_bucket_soft_bag_production_and_disposal_costs": DialysisBucketSoftBagProductionAndDisposalCosts,
            "pharmaceutical_glass_production_and_disposal_costs": PharmaceuticalGlassProductionAndDisposalCosts,
            "paper_iron_aluminum_can_plastic_and_glass_production_and_recycling_revenue": PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenue
        }
        
        model = TABLE_MAPPING.get(table_name)
        if not model:
            return None, [], None
        
        # Get field information
        fields = []
        field_info = {}
        
        if hasattr(model, 'FIELD_INFO'):
            field_info = model.FIELD_INFO
            fields = list(field_info.keys())
        else:
            # Fallback: get fields from model meta
            fields = [f.name for f in model._meta.fields if f.name != 'id']
        
        return model, fields, field_info
    
    @staticmethod
    def create_batch_processor(table_name: str) -> Optional[WasteBatchProcessor]:
        """
        Create a batch processor for a specific table.
        
        Args:
            table_name: Name of the table to process
            
        Returns:
            WasteBatchProcessor instance or None if table not found
        """
        model, fields, _ = WasteDataService.get_model_info(table_name)
        if not model:
            return None
        
        return WasteBatchProcessor(model, fields)