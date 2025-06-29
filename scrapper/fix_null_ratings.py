# fix_null_ratings.py
import pymongo
from bson import ObjectId

# MongoDB connection
MONGO_URI = "mongodb+srv://admin-aman:JvDRbAohOT2a7ymU@cluster0.hjzrf.mongodb.net/seohub?retryWrites=true&w=majority"

def fix_null_ratings():
    """Fix null rating values in tools collection"""
    
    try:
        # Connect to MongoDB
        print("🔄 Connecting to MongoDB...")
        client = pymongo.MongoClient(MONGO_URI)
        client.admin.command('ping')
        print("✅ Connected successfully!")
        
        db = client.seohub
        tools_collection = db.tools
        
        # Find tools with null or missing rating fields
        null_rating_tools = list(tools_collection.find({
            "$or": [
                {"averageRating": None},
                {"averageRating": {"$exists": False}},
                {"totalRatingSum": None},
                {"totalRatingSum": {"$exists": False}},
                {"numberOfRatings": None},
                {"numberOfRatings": {"$exists": False}}
            ]
        }))
        
        print(f"📊 Found {len(null_rating_tools)} tools with null/missing rating fields")
        
        if len(null_rating_tools) == 0:
            print("✅ All tools have valid rating fields!")
            return
        
        # Fix all tools with null ratings
        result = tools_collection.update_many(
            {
                "$or": [
                    {"averageRating": None},
                    {"averageRating": {"$exists": False}},
                    {"totalRatingSum": None},
                    {"totalRatingSum": {"$exists": False}},
                    {"numberOfRatings": None},
                    {"numberOfRatings": {"$exists": False}}
                ]
            },
            {
                "$set": {
                    "averageRating": 0,
                    "totalRatingSum": 0,
                    "numberOfRatings": 0
                }
            }
        )
        
        print(f"✅ Fixed {result.modified_count} tools with null rating fields")
        
        # Verify the fix
        remaining_null = tools_collection.count_documents({
            "$or": [
                {"averageRating": None},
                {"totalRatingSum": None},
                {"numberOfRatings": None}
            ]
        })
        
        if remaining_null == 0:
            print("🎉 All tools now have valid rating fields!")
        else:
            print(f"⚠️  {remaining_null} tools still have null ratings")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    fix_null_ratings()
