# fix_scraped_tools.py
import pymongo
from bson import ObjectId

# MongoDB connection
MONGO_URI = "mongodb+srv://admin-aman:JvDRbAohOT2a7ymU@cluster0.hjzrf.mongodb.net/seohub?retryWrites=true&w=majority"

def fix_scraped_tools():
    """Add submittedBy field to scraped tools"""
    
    try:
        # Connect to MongoDB
        print("🔄 Connecting to MongoDB...")
        client = pymongo.MongoClient(MONGO_URI)
        client.admin.command('ping')
        print("✅ Connected successfully!")
        
        db = client.seohub
        tools_collection = db.tools
        users_collection = db.users
        
        # Find an admin user or create a system user
        admin_user = users_collection.find_one({"role": "admin"})
        
        if not admin_user:
            print("⚠️  No admin user found. Looking for any user...")
            admin_user = users_collection.find_one({})
        
        if not admin_user:
            print("❌ No users found in database!")
            print("   Create a user first, then run this script.")
            return
        
        admin_id = admin_user["_id"]
        print(f"✅ Using user: {admin_user.get('companyName', 'Unknown')} ({admin_user['email']})")
        
        # Find all scraped tools without submittedBy
        scraped_tools = list(tools_collection.find({
            "source": "scraped",
            "$or": [
                {"submittedBy": {"$exists": False}},
                {"submittedBy": None}
            ]
        }))
        
        print(f"📊 Found {len(scraped_tools)} scraped tools needing submittedBy field")
        
        if len(scraped_tools) == 0:
            print("✅ All scraped tools already have submittedBy field!")
            return
        
        # Update all scraped tools
        result = tools_collection.update_many(
            {
                "source": "scraped",
                "$or": [
                    {"submittedBy": {"$exists": False}},
                    {"submittedBy": None}
                ]
            },
            {
                "$set": {
                    "submittedBy": admin_id
                }
            }
        )
        
        print(f"✅ Updated {result.modified_count} tools with submittedBy field")
        
        # Verify the fix
        remaining_broken = tools_collection.count_documents({
            "source": "scraped",
            "$or": [
                {"submittedBy": {"$exists": False}},
                {"submittedBy": None}
            ]
        })
        
        if remaining_broken == 0:
            print("🎉 All scraped tools now have valid submittedBy field!")
            print("   Rating functionality should work now.")
        else:
            print(f"⚠️  {remaining_broken} tools still need fixing")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    fix_scraped_tools()
