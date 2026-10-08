import xml.etree.ElementTree as ET

try:
    tree = ET.parse('sap_metadata.xml')
    root = tree.getroot()
    # Handle different namespace versions
    ns = ''
    for key, value in root.attrib.items():
        pass # could find namespace

    # Find the entity type
    for elem in root.iter():
        if elem.tag.endswith('EntityType') and elem.attrib.get('Name') == 'ProductionOrder':
            print('Entity: ProductionOrder')
            for prop in elem:
                if prop.tag.endswith('Property'):
                    print(f"  {prop.attrib.get('Name')}: {prop.attrib.get('Type')}")
except Exception as e:
    print('Error:', e)
