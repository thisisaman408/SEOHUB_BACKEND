# upload_logo.py
import pymongo
import os
import re
from datetime import datetime
import cloudinary
import cloudinary.uploader
from pymongo import UpdateOne 

# Configure Cloudinary
cloudinary.config(
    cloud_name="dbpjwgvst",  
    api_key="634242721177587",        
    api_secret="oBWhcDIs1jfhwr4gBZXbFSlQd_M"   
)

# MongoDB connection
MONGO_URI = "mongodb+srv://admin-aman:JvDRbAohOT2a7ymU@cluster0.hjzrf.mongodb.net/seohub?retryWrites=true&w=majority"
LOGO_DIR = "tool_logos"

def generate_slug(name):
    """Generate URL-friendly slug from tool name"""
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9 -]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')

def upload_and_update_logos():
    """Upload logos to Cloudinary and update MongoDB with URLs"""
    
    try:
        print("🔄 Starting Cloudinary upload and MongoDB update...")
        
        # Connect to MongoDB
        client = pymongo.MongoClient(MONGO_URI)
        client.admin.command('ping')
        print("✅ Connected to MongoDB successfully!")
        
        db = client.seohub
        tools_collection = db.tools
        
        # Get logo files
        logo_files = [f for f in os.listdir(LOGO_DIR) if f.lower().endswith('.png')]
        print(f"📁 Found {len(logo_files)} logo files")
        
        # Create slug to logo path mapping
        slug_to_logo_path = {}
        for filename in logo_files:
            slug = os.path.splitext(filename)[0]
            slug_to_logo_path[slug] = os.path.join(LOGO_DIR, filename)
        
        # Get tools from database
        tools = list(tools_collection.find({}))
        print(f"📊 Found {len(tools)} tools in database")
        
        bulk_operations = []
        successful_uploads = []
        failed_uploads = []
        
        for tool in tools:
            tool_name = tool.get('name', '')
            tool_slug = tool.get('slug', '')
            tool_id = tool.get('_id')
            
            slug = tool_slug if tool_slug else generate_slug(tool_name)
            
            if slug in slug_to_logo_path:
                logo_path = slug_to_logo_path[slug]
                
                try:
                    print(f"📤 Uploading logo for: {tool_name}")
                    
                    # Upload to Cloudinary
                    upload_result = cloudinary.uploader.upload(
                        logo_path,
                        public_id=f"tool-logos/{slug}",
                        folder="tool-logos",
                        transformation=[
                            {"width": 200, "height": 200, "crop": "limit"},
                            {"quality": "auto"}
                        ]
                    )
                    
                    cloudinary_url = upload_result['secure_url']
                    
                    # ✅ FIXED: Use UpdateOne class with proper format
                    bulk_operations.append(
                        UpdateOne(
                            {'_id': tool_id},
                            {
                                '$set': {
                                    'logoUrl': cloudinary_url,
                                    'updatedAt': datetime.utcnow()  # This is fine, PyMongo handles datetime objects
                                }
                            }
                        )
                    )
                    
                    successful_uploads.append({
                        'name': tool_name,
                        'slug': slug,
                        'url': cloudinary_url
                    })
                    
                except Exception as e:
                    print(f"❌ Failed to upload {tool_name}: {str(e)}")
                    failed_uploads.append({
                        'name': tool_name,
                        'slug': slug,
                        'error': str(e)
                    })
        
        # Execute bulk update
        if bulk_operations:
            print(f"\n🔄 Updating {len(bulk_operations)} tools in database...")
            result = tools_collection.bulk_write(bulk_operations)
            print(f"✅ Successfully updated {result.modified_count} tools!")
        
        # Print summary
        print(f"\n📈 Summary:")
        print(f"   Successful uploads: {len(successful_uploads)}")
        print(f"   Failed uploads: {len(failed_uploads)}")
        
        if successful_uploads:
            print(f"\n✅ Successfully uploaded:")
            for upload in successful_uploads[:5]:
                print(f"   {upload['name']} → {upload['url']}")
            if len(successful_uploads) > 5:
                print(f"   ... and {len(successful_uploads) - 5} more")
        
        if failed_uploads:
            print(f"\n❌ Failed uploads:")
            for fail in failed_uploads:
                print(f"   {fail['name']}: {fail['error']}")
        
        client.close()
        print("\n🎉 Process completed!")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    upload_and_update_logos()
