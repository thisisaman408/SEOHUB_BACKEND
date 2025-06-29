# upload_to_mongo.py
import pymongo
import json
from datetime import datetime
import re

# MongoDB connection
MONGO_URI = "mongodb+srv://admin-aman:JvDRbAohOT2a7ymU@cluster0.hjzrf.mongodb.net/seohub?retryWrites=true&w=majority"

def generate_slug(name):
    """Generate URL-friendly slug from tool name"""
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9 -]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')

def upload_tools_to_mongo():
    """Upload cleaned tools data to MongoDB"""
    
    try:
        # Connect to MongoDB
        print("Connecting to MongoDB...")
        client = pymongo.MongoClient(MONGO_URI)
        
        # Test connection
        client.admin.command('ping')
        print("✅ Connected to MongoDB successfully!")
        
        # Get database and collection
        db = client.seohub
        tools_collection = db.tools
        
        # Read cleaned data
        print("Reading cleaned data from mainData.txt...")
        with open('mainData.txt', 'r', encoding='utf-8') as file:
            tools_data = json.load(file)
        
        print(f"📊 Found {len(tools_data)} tools to upload")
        
        # Add required fields and generate slugs
        processed_tools = []
        for tool in tools_data:
            # Generate unique slug
            base_slug = generate_slug(tool["name"])
            slug = base_slug
            counter = 1
            
            # Check if slug exists
            while tools_collection.find_one({"slug": slug}):
                slug = f"{base_slug}-{counter}"
                counter += 1
            
            # Add missing required fields
            processed_tool = {
                **tool,
                "slug": slug,
                "totalRatingSum": 0,
                "numberOfRatings": 0,
                "averageRating": 0,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }
            
            processed_tools.append(processed_tool)
        
        # Check for existing tools to avoid duplicates
        existing_tools = list(tools_collection.find({}, {"name": 1, "_id": 0}))
        existing_names = {tool["name"] for tool in existing_tools}
        
        # Filter out duplicates
        new_tools = [tool for tool in processed_tools if tool["name"] not in existing_names]
        
        if not new_tools:
            print("⚠️  All tools already exist in the database!")
            return
            
        print(f"🔄 Uploading {len(new_tools)} new tools...")
        
        # Bulk insert
        result = tools_collection.insert_many(new_tools)
        print(f"✅ Successfully uploaded {len(result.inserted_ids)} tools!")
        
        # Print uploaded tool names
        print("\n📋 Uploaded tools:")
        for i, tool in enumerate(new_tools, 1):
            print(f"  {i:2d}. {tool['name']} (slug: {tool['slug']})")
        
        # Print summary
        print(f"\n📈 Summary:")
        print(f"   Total tools in file: {len(tools_data)}")
        print(f"   New tools uploaded: {len(new_tools)}")
        print(f"   Duplicates skipped: {len(tools_data) - len(new_tools)}")
        
        client.close()
        print("\n🎉 Upload completed successfully!")
        
    except FileNotFoundError:
        print("❌ mainData.txt not found! Run clean_data.py first.")
    except pymongo.errors.ConnectionFailure:
        print("❌ Failed to connect to MongoDB. Check your connection string.")
    except json.JSONDecodeError:
        print("❌ Invalid JSON in mainData.txt. Re-run clean_data.py.")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    upload_tools_to_mongo()
