from django.db import models

class Enterprise(models.Model):
    """事業機構"""
    enterprise_code = models.CharField(max_length=20, primary_key=True, verbose_name="事業機構代碼")
    enterprise_name = models.CharField(max_length=200, verbose_name="事業機構名稱")

    class Meta:
        db_table = 'enterprise'
        verbose_name = "事業機構"
        verbose_name_plural = "事業機構"

    def __str__(self):
        return f"{self.enterprise_code} - {self.enterprise_name}"


class Transporter(models.Model):
    """清除者"""
    transporter_code = models.CharField(max_length=20, primary_key=True, verbose_name="清除者代碼")
    transporter_name = models.CharField(max_length=200, verbose_name="清除者名稱")
    other_transporters = models.TextField(blank=True, null=True, verbose_name="其他清除者")

    class Meta:
        db_table = 'transporter'
        verbose_name = "清除者"
        verbose_name_plural = "清除者"

    def __str__(self):
        return f"{self.transporter_code} - {self.transporter_name}"


class TreatmentFacility(models.Model):
    """處理者"""
    treatment_facility_code = models.CharField(max_length=20, primary_key=True, verbose_name="處理者代碼")
    treatment_facility_name = models.CharField(max_length=200, verbose_name="處理者名稱")

    class Meta:
        db_table = 'treatment_facility'
        verbose_name = "處理者"
        verbose_name_plural = "處理者"

    def __str__(self):
        return f"{self.treatment_facility_code} - {self.treatment_facility_name}"


class Recycler(models.Model):
    """再利用者"""
    recycler_code = models.CharField(max_length=20, primary_key=True, verbose_name="再利用者代碼")
    recycler_name = models.CharField(max_length=200, verbose_name="再利用者名稱")
    recycling_purpose = models.CharField(max_length=100, blank=True, null=True, verbose_name="再利用用途")
    recycling_purpose_description = models.TextField(blank=True, null=True, verbose_name="再利用用途說明")
    recycling_method = models.CharField(max_length=100, blank=True, null=True, verbose_name="再利用方式")
    recycler_type = models.CharField(max_length=100, blank=True, null=True, verbose_name="再利用者性質")
    recycling_completion_datetime = models.DateTimeField(blank=True, null=True, verbose_name="再利用完成日期/時間")
    actual_recycler_vehicle_number = models.CharField(max_length=20, blank=True, null=True,
                                                      verbose_name="再利用者實際運載車號")

    class Meta:
        db_table = 'recycler'
        verbose_name = "再利用者"
        verbose_name_plural = "再利用者"

    def __str__(self):
        return f"{self.recycler_code} - {self.recycler_name}"


class Process(models.Model):
    """製程"""
    process_code = models.CharField(max_length=20, primary_key=True, verbose_name="製程代碼")
    process_name = models.CharField(max_length=200, verbose_name="製程名稱")

    class Meta:
        db_table = 'process'
        verbose_name = "製程"
        verbose_name_plural = "製程"

    def __str__(self):
        return f"{self.process_code} - {self.process_name}"


class WasteSubstance(models.Model):
    """廢棄物/物質"""
    waste_substance_code = models.CharField(max_length=20, primary_key=True, verbose_name="廢棄物/物質代碼")
    waste_substance_name = models.CharField(max_length=500, verbose_name="廢棄物/物質名稱")

    class Meta:
        db_table = 'waste_substance'
        verbose_name = "廢棄物/物質"
        verbose_name_plural = "廢棄物/物質"

    def __str__(self):
        return f"{self.waste_substance_code} - {self.waste_substance_name}"


class TransportVehicle(models.Model):
    """清運車輛"""
    transport_vehicle_number = models.CharField(max_length=20, primary_key=True, verbose_name="清除運載車號")
    transporter = models.ForeignKey(Transporter, on_delete=models.CASCADE, verbose_name="清除者代碼")

    class Meta:
        db_table = 'transport_vehicle'
        verbose_name = "清運車輛"
        verbose_name_plural = "清運車輛"

    def __str__(self):
        return self.transport_vehicle_number


class TreatmentVehicle(models.Model):
    """處理車輛"""
    treatment_vehicle_number = models.CharField(max_length=20, primary_key=True, verbose_name="處理運載車號")
    treatment_facility = models.ForeignKey(TreatmentFacility, on_delete=models.CASCADE, verbose_name="處理者代碼")

    class Meta:
        db_table = 'treatment_vehicle'
        verbose_name = "處理車輛"
        verbose_name_plural = "處理車輛"

    def __str__(self):
        return self.treatment_vehicle_number


class RecoveryVehicle(models.Model):
    """回收車輛"""
    recovery_vehicle_number = models.CharField(max_length=20, primary_key=True, verbose_name="回收運載車號")
    recycler = models.ForeignKey(Recycler, on_delete=models.CASCADE, verbose_name="再利用者代碼")

    class Meta:
        db_table = 'recovery_vehicle'
        verbose_name = "回收車輛"
        verbose_name_plural = "回收車輛"

    def __str__(self):
        return self.recovery_vehicle_number


class Declaration(models.Model):
    """申報單"""
    declaration_code = models.CharField(max_length=50, primary_key=True, verbose_name="申報單代碼")
    enterprise = models.ForeignKey(Enterprise, on_delete=models.CASCADE, verbose_name="事業機構代碼")
    declaration_datetime = models.DateTimeField(verbose_name="申報日期/時間")
    declared_weight = models.FloatField(verbose_name="申報重量")

    class Meta:
        db_table = 'declaration'
        verbose_name = "申報單"
        verbose_name_plural = "申報單"

    def __str__(self):
        return self.declaration_code


class Transportation(models.Model):
    """清運單"""
    transportation_code = models.CharField(max_length=50, primary_key=True, verbose_name="清運單代碼")
    transporter = models.ForeignKey(Transporter, on_delete=models.CASCADE, verbose_name="清除者代碼")
    transportation_datetime = models.DateTimeField(verbose_name="清運日期/時間")
    transport_vehicle = models.ForeignKey(TransportVehicle, on_delete=models.CASCADE, verbose_name="清除運載車號")
    delivery_datetime = models.DateTimeField(verbose_name="運送日期/時間")

    class Meta:
        db_table = 'transportation'
        verbose_name = "清運單"
        verbose_name_plural = "清運單"

    def __str__(self):
        return self.transportation_code


class Treatment(models.Model):
    """處理單"""
    treatment_code = models.CharField(max_length=50, primary_key=True, verbose_name="處理單代碼")
    treatment_facility = models.ForeignKey(TreatmentFacility, on_delete=models.CASCADE, verbose_name="處理者代碼")
    receipt_datetime = models.DateTimeField(verbose_name="收受日期/時間")
    treatment_vehicle = models.ForeignKey(TreatmentVehicle, on_delete=models.CASCADE, verbose_name="處理運載車號")
    intermediate_treatment_method = models.CharField(max_length=100, verbose_name="中間處理方式")
    final_disposal_method = models.CharField(max_length=100, verbose_name="最終處置方式")
    treatment_completion_datetime = models.DateTimeField(blank=True, null=True, verbose_name="處理完成日期/時間")

    class Meta:
        db_table = 'treatment'
        verbose_name = "處理單"
        verbose_name_plural = "處理單"

    def __str__(self):
        return self.treatment_code


class Recovery(models.Model):
    """回收單"""
    recovery_code = models.CharField(max_length=50, primary_key=True, verbose_name="回收單代碼")
    recycler = models.ForeignKey(Recycler, on_delete=models.CASCADE, verbose_name="再利用者代碼")
    recovery_datetime = models.DateTimeField(verbose_name="回收日期/時間")
    recovery_vehicle = models.ForeignKey(RecoveryVehicle, on_delete=models.CASCADE, verbose_name="回收運載車號")

    class Meta:
        db_table = 'recovery'
        verbose_name = "回收單"
        verbose_name_plural = "回收單"

    def __str__(self):
        return self.recovery_code


class WasteSubstanceId(models.Model):
    """廢棄物/物質ID"""
    waste_substance_id = models.AutoField(primary_key=True, verbose_name="廢棄物/物質ID")
    process = models.ForeignKey(Process, on_delete=models.CASCADE, verbose_name="製程代碼")
    waste_substance_code = models.ForeignKey(WasteSubstance, on_delete=models.CASCADE, verbose_name="廢棄物/物質代碼")

    class Meta:
        db_table = 'waste_substance_id'
        verbose_name = "廢棄物/物質ID"
        verbose_name_plural = "廢棄物/物質ID"
        unique_together = ('process', 'waste_substance_code')

    def __str__(self):
        return f"{self.waste_substance_id}"


class Manifest(models.Model):
    """聯單"""
    manifest_number = models.CharField(max_length=50, verbose_name="聯單編號")
    waste_substance_id = models.ForeignKey(WasteSubstanceId, on_delete=models.CASCADE, verbose_name="廢棄物/物質ID")
    declaration = models.ForeignKey(Declaration, on_delete=models.CASCADE, verbose_name="申報單代碼")
    vehicle_number = models.CharField(max_length=20, verbose_name="運載車號")
    transportation = models.ForeignKey(Transportation, on_delete=models.CASCADE, verbose_name="清運單代碼")
    treatment = models.ForeignKey(Treatment, on_delete=models.CASCADE, blank=True, null=True, verbose_name="處理單代碼")
    recovery = models.ForeignKey(Recovery, on_delete=models.CASCADE, blank=True, null=True, verbose_name="回收單代碼")
    is_visible = models.BooleanField(default=True, verbose_name="是否可見")

    class Meta:
        db_table = 'manifest'
        verbose_name = "聯單"
        verbose_name_plural = "聯單"
        unique_together = ('manifest_number', 'waste_substance_id')
        indexes = [
            # Performance indexes for common query patterns
            models.Index(fields=['is_visible', 'manifest_number'], name='manifest_vis_num_idx'),
            models.Index(fields=['is_visible', '-id'], name='manifest_vis_id_idx'),  # For pagination
            models.Index(fields=['declaration'], name='manifest_decl_idx'),  # Declaration FK
            models.Index(fields=['transportation'], name='manifest_trans_idx'),  # Transportation FK
            models.Index(fields=['treatment'], name='manifest_treat_idx'),  # For disposal filtering
            models.Index(fields=['recovery'], name='manifest_recov_idx'),  # For reuse filtering
        ]

    def __str__(self):
        return f"{self.manifest_number} - {self.waste_substance_id}"

    @property
    def manifest_type(self):
        """Return manifest type based on treatment/recovery"""
        if self.treatment:
            return "disposal"  # 清除單
        elif self.recovery:
            return "reuse"  # 再利用單
        return "unknown"

    @property
    def manifest_type_display(self):
        """Return display name for manifest type"""
        if self.treatment:
            return "清除單"
        elif self.recovery:
            return "再利用單"
        return "未知"