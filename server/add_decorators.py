"""
Script to add @api_login_required decorator to all admin endpoints
"""

import re
from pathlib import Path

# Read the views.py file
views_path = Path(__file__).parent / 'api' / 'views.py'
content = views_path.read_text(encoding='utf-8')

# List of admin functions that need protection
admin_functions = [
    'admin_devices',
    'admin_device_stats',
    'admin_rename_device',
    'admin_customize_device',
    'admin_delete_device',
    'admin_merge_device',
    'admin_whitelist_status',
    'admin_whitelist_toggle',
    'admin_whitelist_devices',
    'admin_whitelist_set',
    'admin_whitelist_all',
    'admin_whitelist_add_mac',
]

# Pattern to match function definitions
# Looks for decorators + function def, captures everything before 'def'
pattern = r'((?:@[^\n]+\n)*)(def ({}))\('

for func_name in admin_functions:
    func_pattern = pattern.format(func_name)
    
    # Check if function already has @api_login_required
    if f'@api_login_required\ndef {func_name}' in content:
        print(f'✓ {func_name} already protected')
        continue
    
    # Find the function and add decorator
    match = re.search(func_pattern, content)
    if match:
        decorators = match.group(1)
        # Add @api_login_required before the function def
        replacement = f'{decorators}@api_login_required\n{match.group(2)}('
        content = content.replace(match.group(0), replacement)
        print(f'✓ Added @api_login_required to {func_name}')
    else:
        print(f'✗ Could not find function: {func_name}')

# Write back
views_path.write_text(content, encoding='utf-8')
print('\n✓ All admin endpoints protected!')
