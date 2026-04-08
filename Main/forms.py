from django import forms
from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth.models import User

class PasswordChangeForm(PasswordChangeForm):
    old_password = forms.CharField(
        widget=forms.PasswordInput(attrs={"class": "ts-input", "placeholder": ""}),
    )
    new_password1 = forms.CharField(
        widget=forms.PasswordInput(attrs={"class": "ts-input", "placeholder": ""}),
    )
    new_password2 = forms.CharField(
        widget=forms.PasswordInput(attrs={"class": "ts-input", "placeholder": ""}),
    )
