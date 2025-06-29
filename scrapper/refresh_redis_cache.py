# refresh_redis_cache.py
import pymongo
import redis
import json
from datetime import datetime
from bson import ObjectId
import traceback

# Connection strings
MONGO_URI = "mongodb+srv://admin-aman:JvDRbAohOT2a7ymU@cluster0.hjzrf.mongodb.net/seohub?retryWrites=true&w=majority"
REDIS_URL = "redis://default:jlthqq2fhAliCTyh3qRQK1zkIXOLBm9g@redis-14773.c212.ap-south-1-1.ec2.redns.redis-cloud.com:14773"

class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles ObjectId and datetime objects"""
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def convert_mongo_doc(obj):
    """Convert MongoDB document to JSON-serializable format"""
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {key: convert_mongo_doc(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_mongo_doc(item) for item in obj]
    else:
        return obj

def refresh_redis_cache():
    """Refresh Redis cache with latest data from MongoDB - matching backend pattern"""
    
    mongo_client = None
    redis_client = None
    
    try:
        print("🔄 Starting Redis cache refresh...")
        
        # Connect to MongoDB
        print("📊 Connecting to MongoDB...")
        mongo_client = pymongo.MongoClient(MONGO_URI)
        mongo_client.admin.command('ping')
        print("✅ Connected to MongoDB successfully!")
        
        # Connect to Redis
        print("🔌 Connecting to Redis...")
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        redis_client.ping()
        print("✅ Connected to Redis successfully!")
        
        # Get database and collection
        db = mongo_client.seohub
        tools_collection = db.tools
        
        print("\n🧹 Clearing existing cache...")
        clear_cache(redis_client)
        
        # Fetch approved tools - EXACTLY like your getAllTools controller
        print("📥 Fetching approved tools from MongoDB...")
        tools_cursor = tools_collection.find({'status': 'approved'}).sort([
            ('isFeatured', -1), 
            ('createdAt', -1)
        ])
        
        # Convert to list and handle MongoDB types
        all_approved_tools = []
        for i, tool in enumerate(tools_cursor):
            try:
                # Convert MongoDB document to JSON-serializable format
                cleaned_tool = convert_mongo_doc(tool)
                all_approved_tools.append(cleaned_tool)
                
                if (i + 1) % 10 == 0:
                    print(f"   📝 Processed {i + 1} tools...")
                    
            except Exception as e:
                print(f"⚠️  Error processing tool {i + 1}: {e}")
                continue
        
        print(f"📊 Successfully processed {len(all_approved_tools)} approved tools")
        
        # Cache allTools - EXACTLY like your backend: JSON.stringify(tools)
        print("💾 Caching all approved tools...")
        try:
            tools_json = json.dumps(all_approved_tools, cls=DateTimeEncoder)
            redis_client.setex('allTools', 3600, tools_json)
            print("✅ Cached allTools")
        except Exception as e:
            print(f"❌ Error caching allTools: {e}")
            raise
        
        # Cache featured tools - EXACTLY like your getFeaturedTools controller
        print("⭐ Caching featured tools...")
        featured_tools = [tool for tool in all_approved_tools if tool.get('isFeatured', False)]
        try:
            featured_json = json.dumps(featured_tools, cls=DateTimeEncoder)
            redis_client.setex('featuredTools', 3600, featured_json)
            print(f"✅ Cached {len(featured_tools)} featured tools")
        except Exception as e:
            print(f"❌ Error caching featured tools: {e}")
            raise
        
        # Cache individual tools by ID and slug - like your getToolById/getToolBySlug
        print("🔍 Caching individual tools...")
        cached_count = 0
        error_count = 0
        
        for i, tool in enumerate(all_approved_tools):
            try:
                tool_json = json.dumps(tool, cls=DateTimeEncoder)
                
                # Cache by ID
                tool_id_key = f"tool:{tool['_id']}"
                redis_client.setex(tool_id_key, 3600, tool_json)
                
                # Cache by slug if exists
                if 'slug' in tool and tool['slug']:
                    tool_slug_key = f"tool:slug:{tool['slug']}"
                    redis_client.setex(tool_slug_key, 3600, tool_json)
                
                cached_count += 1
                
                if (i + 1) % 10 == 0:
                    print(f"   📝 Cached {i + 1}/{len(all_approved_tools)} tools...")
                    
            except Exception as e:
                error_count += 1
                print(f"⚠️  Error caching tool {tool.get('name', 'Unknown')}: {e}")
                continue
        
        print(f"✅ Successfully cached {cached_count} individual tools")
        if error_count > 0:
            print(f"⚠️  {error_count} tools had caching errors")
        
        # Cache metadata
        cache_info = {
            "lastUpdated": datetime.utcnow().isoformat(),
            "totalTools": len(all_approved_tools),
            "featuredTools": len(featured_tools),
            "cacheVersion": "1.0",
            "cachedIndividually": cached_count,
            "errors": error_count
        }
        redis_client.setex('cache:meta', 3600, json.dumps(cache_info))
        print("✅ Set cache metadata")
        
        # Summary
        print(f"\n🎉 Redis cache refresh completed successfully!")
        print(f"   📊 Total tools cached: {len(all_approved_tools)}")
        print(f"   ⭐ Featured tools: {len(featured_tools)}")
        print(f"   🔍 Individual caches: {cached_count}")
        print(f"   ⚠️  Errors: {error_count}")
        print(f"   ⏰ Cache TTL: 1 hour (matching backend)")
        print(f"   🔑 Cache keys created: {3 + (cached_count * 2)}")
        
        # Test one cached tool to verify JSON format
        if all_approved_tools:
            try:
                test_tool = redis_client.get(f"tool:{all_approved_tools[0]['_id']}")
                if test_tool:
                    parsed_tool = json.loads(test_tool)
                    print(f"   ✅ Cache verification: Tool '{parsed_tool['name']}' cached correctly")
            except Exception as e:
                print(f"   ⚠️  Cache verification failed: {e}")
        
    except Exception as e:
        print(f"❌ Error during cache refresh: {str(e)}")
        print("\n🔍 Full error traceback:")
        traceback.print_exc()
    
    finally:
        if mongo_client:
            mongo_client.close()
        if redis_client:
            redis_client.close()

def clear_cache(redis_client):
    """Clear existing cache keys"""
    try:
        # Clear main cache keys
        keys_to_clear = ['allTools', 'featuredTools', 'cache:meta']
        cleared_count = 0
        
        for key in keys_to_clear:
            if redis_client.exists(key):
                redis_client.delete(key)
                cleared_count += 1
                print(f"   🗑️  Cleared: {key}")
        
        # Clear tool-specific caches
        tool_keys = redis_client.keys('tool:*')
        if tool_keys:
            redis_client.delete(*tool_keys)
            cleared_count += len(tool_keys)
            print(f"   🗑️  Cleared {len(tool_keys)} tool-specific cache keys")
        
        print(f"✅ Cache cleared successfully ({cleared_count} keys)")
        
    except Exception as e:
        print(f"⚠️  Warning: Could not clear all cache keys: {e}")

if __name__ == "__main__":
    refresh_redis_cache()
