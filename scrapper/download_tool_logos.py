# download_tool_logos.py
import os
import re
import json
import requests
import time
from urllib.parse import urlparse
from pathlib import Path

def generate_slug(name):
    """Generate URL-friendly slug from tool name - same as upload_to_mongo.py"""
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9 -]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')

def extract_domain(url):
    """Extract clean domain from URL"""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc
        # Remove 'www.' if present
        if domain.startswith('www.'):
            domain = domain[4:]
        return domain
    except:
        return None

def download_logo(url, file_path, timeout=10):
    """Download logo from URL and save to file_path"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=timeout)
        
        if response.status_code == 200:
            # Check if response contains actual image data
            content_type = response.headers.get('content-type', '').lower()
            if 'image' in content_type or len(response.content) > 1000:  # Assume files > 1KB are likely images
                with open(file_path, 'wb') as f:
                    f.write(response.content)
                return True
        return False
    except Exception as e:
        print(f"   ❌ Error downloading {url}: {str(e)}")
        return False

def clean_and_parse_tools_data(file_path):
    """Parse tools data from paste.txt format"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Split by separator
        tool_blocks = content.split("================================================================================")
        tools = []
        
        for i, block in enumerate(tool_blocks):
            # Remove comments and empty lines
            lines = block.strip().split('\n')
            json_lines = []
            
            for line in lines:
                stripped_line = line.strip()
                # Skip empty lines and comment lines
                if stripped_line and not stripped_line.startswith('//'):
                    json_lines.append(line)
            
            # Join the remaining lines
            json_text = '\n'.join(json_lines).strip()
            
            if not json_text:
                continue
                
            try:
                # Parse the JSON
                tool_data = json.loads(json_text)
                tools.append(tool_data)
                
            except json.JSONDecodeError as e:
                print(f"⚠️  Error parsing tool block {i+1}: {e}")
                # Print the problematic JSON for debugging
                print(f"   Problematic JSON: {json_text[:100]}...")
                continue
        
        print(f"✅ Successfully parsed {len(tools)} tools from {file_path}")
        return tools
        
    except FileNotFoundError:
        print(f"❌ File {file_path} not found!")
        return []
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return []

def try_multiple_logo_sources(tool_name, website_url, slug):
    """Try multiple sources to get tool logo"""
    domain = extract_domain(website_url)
    logo_sources = []
    
    if domain:
        # Source 1: Clearbit Logo API
        logo_sources.append({
            'name': 'Clearbit',
            'url': f'https://logo.clearbit.com/{domain}',
            'description': f'Clearbit API for {domain}'
        })
        
        # Source 2: Favicon from domain
        logo_sources.append({
            'name': 'Favicon',
            'url': f'https://{domain}/favicon.ico',
            'description': f'Favicon from {domain}'
        })
        
        # Source 3: Google Favicon API
        logo_sources.append({
            'name': 'Google Favicon',
            'url': f'https://www.google.com/s2/favicons?domain={domain}&sz=128',
            'description': f'Google Favicon API for {domain}'
        })
        
        # Source 4: Alternative logo paths
        logo_sources.extend([
            {
                'name': 'Logo Path 1',
                'url': f'https://{domain}/logo.png',
                'description': f'Direct logo.png from {domain}'
            },
            {
                'name': 'Logo Path 2', 
                'url': f'https://{domain}/assets/logo.png',
                'description': f'Assets logo from {domain}'
            }
        ])
    
    return logo_sources

def download_tool_logos():
    """Main function to download logos for all tools"""
    print("🚀 Starting Tool Logo Downloader...")
    
    # Configuration
    input_file = 'ai_tools_submitTool_format.txt'  # The paste.txt file
    logo_dir = 'tool_logos'
    
    # Alternative file names to try
    possible_files = [
        'ai_tools_submitTool_format.txt',
        'paste.txt', 
        'mainData.txt'
    ]
    
    # Find the input file
    tools_data = []
    for file_name in possible_files:
        if os.path.exists(file_name):
            print(f"📄 Found data file: {file_name}")
            tools_data = clean_and_parse_tools_data(file_name)
            if tools_data:
                break
    
    if not tools_data:
        print("❌ No valid tools data found! Make sure one of these files exists:")
        for file_name in possible_files:
            print(f"   - {file_name}")
        return
    
    # Create logos directory
    Path(logo_dir).mkdir(exist_ok=True)
    print(f"📁 Created/verified directory: {logo_dir}")
    
    # Download logos
    results = []
    successful_downloads = 0
    failed_downloads = 0
    
    print(f"\n🔽 Starting download for {len(tools_data)} tools...\n")
    
    for i, tool in enumerate(tools_data, 1):
        tool_name = tool.get('name', f'Tool_{i}')
        website_url = tool.get('websiteUrl', '')
        slug = generate_slug(tool_name)
        
        print(f"[{i:2d}/{len(tools_data)}] Processing: {tool_name}")
        print(f"   🔗 Website: {website_url}")
        print(f"   📝 Slug: {slug}")
        
        if not website_url:
            print(f"   ⚠️  No website URL provided")
            results.append({
                'name': tool_name,
                'slug': slug,
                'status': 'no_website_url',
                'website_url': website_url
            })
            failed_downloads += 1
            continue
        
        # Try multiple logo sources
        logo_sources = try_multiple_logo_sources(tool_name, website_url, slug)
        logo_downloaded = False
        
        for source in logo_sources:
            if logo_downloaded:
                break
                
            file_path = os.path.join(logo_dir, f'{slug}.png')
            print(f"   🔍 Trying {source['name']}: {source['url']}")
            
            success = download_logo(source['url'], file_path)
            
            if success:
                # Verify the downloaded file is not too small (likely an error page)
                file_size = os.path.getsize(file_path)
                if file_size > 500:  # At least 500 bytes
                    print(f"   ✅ Downloaded from {source['name']} ({file_size} bytes)")
                    logo_downloaded = True
                    successful_downloads += 1
                    results.append({
                        'name': tool_name,
                        'slug': slug,
                        'status': 'downloaded',
                        'source': source['name'],
                        'source_url': source['url'],
                        'file_size': file_size,
                        'website_url': website_url
                    })
                else:
                    # File too small, probably an error - delete it
                    os.remove(file_path)
                    print(f"   ⚠️  File too small from {source['name']}, trying next source...")
        
        if not logo_downloaded:
            print(f"   ❌ Failed to download logo from any source")
            failed_downloads += 1
            results.append({
                'name': tool_name,
                'slug': slug,
                'status': 'failed_all_sources',
                'website_url': website_url
            })
        
        # Add small delay to be respectful to servers
        time.sleep(0.5)
        print()
    
    # Generate summary report
    print("="*60)
    print("📊 DOWNLOAD SUMMARY")
    print("="*60)
    print(f"✅ Successful downloads: {successful_downloads}")
    print(f"❌ Failed downloads: {failed_downloads}")
    print(f"📊 Total tools processed: {len(tools_data)}")
    print(f"📁 Logos saved in: {logo_dir}/")
    
    # Save detailed report
    report_file = 'logo_download_report.json'
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump({
            'summary': {
                'total_tools': len(tools_data),
                'successful_downloads': successful_downloads,
                'failed_downloads': failed_downloads,
                'success_rate': f"{(successful_downloads/len(tools_data)*100):.1f}%"
            },
            'results': results
        }, f, indent=2, ensure_ascii=False)
    
    print(f"📄 Detailed report saved: {report_file}")
    
    # Show successful downloads
    if successful_downloads > 0:
        print(f"\n✅ Successfully downloaded logos:")
        for result in results:
            if result['status'] == 'downloaded':
                print(f"   {result['slug']}.png - {result['name']} ({result['source']})")
    
    # Show failed downloads
    if failed_downloads > 0:
        print(f"\n❌ Failed downloads:")
        for result in results:
            if result['status'] != 'downloaded':
                print(f"   {result['slug']} - {result['name']} ({result['status']})")
    
    print(f"\n🎉 Logo download process completed!")
    return results

if __name__ == "__main__":
    results = download_tool_logos()
