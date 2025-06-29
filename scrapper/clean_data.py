# clean_data.py
import re
import json

def clean_ai_tools_data():
    """Clean the AI tools data file and extract JSON objects"""
    
    # Read the input file
    with open('ai_tools_submitTool_format.txt', 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Split by the separator
    tool_blocks = content.split("================================================================================")
    
    cleaned_tools = []
    
    for i, block in enumerate(tool_blocks):
        # Remove comments (lines starting with //)
        lines = block.split('\n')
        json_lines = []
        
        for line in lines:
            # Skip empty lines and comment lines
            if line.strip() and not line.strip().startswith('//'):
                json_lines.append(line)
        
        # Join the remaining lines
        json_text = '\n'.join(json_lines).strip()
        
        if not json_text:
            continue
            
        try:
            # Parse the JSON
            tool_data = json.loads(json_text)
            
            # Transform to match your database schema
            transformed_tool = {
                "name": tool_data["name"],
                "tagline": tool_data["tagline"], 
                "description": tool_data["description"],
                "websiteUrl": tool_data["websiteUrl"],
                "tags": tool_data["tags"].split(",") if tool_data["tags"] else [],
                "appStoreUrl": tool_data.get("appStoreUrl") or "",
                "playStoreUrl": tool_data.get("playStoreUrl") or "",
                "status": "approved",
                "isFeatured": False,
                "logoUrl": "",
                "visual": {
                    "type": tool_data.get("visual", {}).get("type", "gradient"),
                    "color": tool_data.get("visual", {}).get("color", "#3B82F6"),
                    "content": tool_data.get("visual", {}).get("content", [])
                },
                "source": "scraped",
                "analytics": {
                    "totalViews": 0,
                    "uniqueViews": 0,
                    "weeklyViews": 0,
                    "monthlyViews": 0
                },
                "commentStats": {
                    "totalComments": 0,
                    "approvedComments": 0
                },
                "mediaStats": {
                    "totalMedia": 0,
                    "screenshots": 0,
                    "videos": 0
                }
            }
            
            cleaned_tools.append(transformed_tool)
            print(f"✅ Processed: {tool_data['name']}")
            
        except json.JSONDecodeError as e:
            print(f"❌ Error parsing tool {i+1}: {e}")
            print(f"Block content: {json_text[:100]}...")
            continue
    
    # Write cleaned data to mainData.txt
    with open('mainData.txt', 'w', encoding='utf-8') as file:
        json.dump(cleaned_tools, file, indent=2, ensure_ascii=False)
    
    print(f"\n🎉 Successfully cleaned {len(cleaned_tools)} tools!")
    print("📄 Cleaned data saved to mainData.txt")
    
    return cleaned_tools

if __name__ == "__main__":
    clean_ai_tools_data()
