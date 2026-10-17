import json
from pathlib import Path

path = Path('src/lib/ocr/dictionnaire-fiscal-complet-2025.json')
data = json.loads(path.read_text())
t4a = next(s for s in data['slips'] if s.get('code') == 'T4A')
boxes = {str(b['code']): b for b in t4a['boxes']}

# Cases T4A qui doivent alimenter la déclaration, selon les instructions ARC.
line_13000 = {
    '028': 'Autres revenus',
    '030': 'Répartitions selon l’apport commercial',
    '040': 'Paiements de revenu accumulé d’un REEE',
    '042': 'Paiements d’aide aux études d’un REEE',
    '129': 'Part de coopérative à imposition différée',
    '197': 'Prestation canadienne d’urgence (PCU)',
    '198': 'Prestation canadienne d’urgence pour les étudiants (PCUE)',
    '199': 'PCUE — étudiants admissibles ayant un handicap ou des personnes à charge',
    '200': 'Prestations provinciales ou territoriales de soutien financier COVID-19',
    '202': 'Prestation canadienne de la relance économique (PCRE)',
    '203': 'Prestation canadienne de maladie pour la relance économique (PCMRE)',
    '204': 'Prestation canadienne de la relance économique pour proches aidants (PCREPA)',
    '205': 'Paiement unique pour les aînés',
    '211': 'Prestation canadienne pour les travailleurs en cas de confinement (PCTCC)',
}
for code, label in line_13000.items():
    if code in boxes:
        boxes[code]['t1_line'] = '13000'
        boxes[code]['data_type'] = 'money'
        boxes[code]['notes'] = f"{label}. Déclaration à la ligne 13000 selon les instructions de l’ARC."

# Cases qui ne sont pas des revenus à ajouter à la ligne 13000.
if '201' in boxes:
    boxes['201']['t1_line'] = '23200'
    boxes['201']['data_type'] = 'money'
    boxes['201']['notes'] = 'Remboursement de prestations COVID : ligne 23210 pour une prestation fédérale antérieure; ligne 23200 pour une prestation provinciale ou territoriale.'
if '022' in boxes:
    boxes['022']['t1_line'] = '43700'
    boxes['022']['data_type'] = 'money'
if '048' in boxes:
    boxes['048']['data_type'] = 'money'
    boxes['048']['notes'] = 'Honoraires ou autres sommes pour services rendus : revenu d’entreprise ou de profession libérale; le montant ne doit être pris que s’il est réellement inscrit dans la case 048.'

# Instructions structurées conservées au niveau du feuillet pour que l’interface,
# les diagnostics et les futurs parseurs disposent de la même source officielle.
t4a['reporting_instructions'] = {
    'authority': 'Agence du revenu du Canada (ARC)',
    'source': 'Instructions « Déclarez ces montants dans votre déclaration de revenus » du feuillet T4A.',
    'line_11500': ['016', '024', '194'],
    'line_13000': sorted(line_13000),
    'line_13010': ['105'],
    'line_13499_13500': ['105'],
    'line_13500_business_or_professional_income': ['048'],
    'line_13899_and_13900': ['020'],
    'line_10400': ['104', '107', '118', '119', '127', '132', '152', '156'],
    'line_12500': ['131'],
    'line_13000_with_special_forms': ['040', '042'],
    'line_20700': ['032'],
    'line_20600': ['034'],
    'line_23200_or_23210_repayment': ['201'],
    'line_25600': ['196'],
    'line_33099': ['135'],
    'informational_only_do_not_report': ['012', '014', '036', '037', '116', '124', '144', '146', '148', '195', '210'],
    'included_in_other_box': {
        '016': ['128'],
        '018': ['102', '108', '110', '158', '180', '190'],
        '024': ['111', '115'],
        '032': ['126', '162'],
        '040': ['122'],
    },
    'covid_cases': {
        '197': {'name': 'PCU', 'line': '13000'},
        '198': {'name': 'PCUE', 'line': '13000'},
        '199': {'name': 'PCUE admissible', 'line': '13000'},
        '200': {'name': 'Prestation provinciale ou territoriale COVID-19', 'line': '13000'},
        '201': {'name': 'Remboursement COVID-19', 'line': '23200 ou 23210 selon la prestation'},
        '202': {'name': 'PCRE', 'line': '13000'},
        '203': {'name': 'PCMRE', 'line': '13000'},
        '204': {'name': 'PCREPA', 'line': '13000'},
        '211': {'name': 'PCTCC', 'line': '13000'},
    },
    'validation_rule': 'Une case est calculée uniquement si une valeur monétaire est effectivement extraite de la zone de cette case. Les numéros d’adresse, codes de case, NAS et valeurs provenant des instructions ne sont jamais des montants fiscaux.',
}

path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print(f'Mis à jour : {path}')
print('Cases 13000:', ', '.join(sorted(line_13000)))
