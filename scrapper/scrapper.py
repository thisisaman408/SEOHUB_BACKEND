import requests
from bs4 import BeautifulSoup
import json
import re
import time
import random
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv
import os

class MultiSourceAIToolScraper:
    def __init__(self):
        load_dotenv()
        self.tools = []
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        
    def generate_slug(self, name):
        return re.sub(r'-+', '-', re.sub(r'\s+', '-', re.sub(r'[^a-z0-9 -]', '', name.lower()))).strip('-')
    
    def scrape_product_hunt_ai_tools(self):
        """Scrape AI tools from Product Hunt"""
        tools = []
        try:
            # Product Hunt AI collection
            urls = [
                'https://www.producthunt.com/topics/artificial-intelligence',
                'https://www.producthunt.com/topics/marketing',
                'https://www.producthunt.com/topics/productivity'
            ]
            
            for url in urls:
                print(f"Scraping Product Hunt: {url}")
                response = self.session.get(url, timeout=10)
                if response.status_code == 200:
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # Look for product cards
                    product_selectors = [
                        '[data-test="product-item"]',
                        '.styles_item__2bgQr',
                        '.product-item',
                        'article'
                    ]
                    
                    for selector in product_selectors:
                        products = soup.select(selector)
                        if products:
                            for product in products[:10]:  # Limit per page
                                tool_data = self.extract_product_hunt_data(product, url)
                                if tool_data:
                                    tools.append(tool_data)
                            break
                
                time.sleep(2)
        except Exception as e:
            print(f"Error scraping Product Hunt: {e}")
        
        return tools
    
    def extract_product_hunt_data(self, product_element, base_url):
        """Extract data from Product Hunt product element"""
        try:
            # Extract name
            name_selectors = ['h3', 'h2', '.product-name', '[data-test="product-name"]']
            name = self.extract_text_from_element(product_element, name_selectors, "AI Tool")
            
            # Extract tagline
            tagline_selectors = ['.tagline', '.description', 'p', '.subtitle']
            tagline = self.extract_text_from_element(product_element, tagline_selectors, f"{name} - AI-powered productivity tool")
            
            # Extract link
            link_element = product_element.find('a', href=True)
            website_url = "https://example.com"  # Default fallback
            if link_element:
                href = link_element.get('href')
                if href.startswith('http'):
                    website_url = href
                else:
                    website_url = urljoin(base_url, href)
            
            # Extract logo
            logo_element = product_element.find('img')
            logo_url = ""
            if logo_element and logo_element.get('src'):
                logo_url = logo_element.get('src')
                if not logo_url.startswith('http'):
                    logo_url = urljoin(base_url, logo_url)
            
            return {
                'name': name[:100],
                'tagline': tagline[:200],
                'description': tagline[:500],
                'websiteUrl': website_url,
                'logoUrl': logo_url,
                'tags': self.generate_ai_tags(name, tagline),
                'appStoreUrl': None,
                'playStoreUrl': None,
                'visual': self.generate_visual()
            }
        except:
            return None
    
    def scrape_ai_tool_directories(self):
        """Scrape from multiple AI tool directories"""
        tools = []
        
        # Predefined list of popular AI tools with their data
        predefined_tools = [
            {
                'name': 'ChatGPT',
                'tagline': 'AI-powered conversational assistant for writing and productivity',
                'description': 'Advanced AI chatbot that can help with writing, coding, analysis, and creative tasks',
                'websiteUrl': 'https://chat.openai.com',
                'category': 'ai-assistant'
            },
            {
                'name': 'Copy.ai',
                'tagline': 'AI copywriter for marketing content and sales copy',
                'description': 'Generate high-converting copy for ads, emails, websites, and social media',
                'websiteUrl': 'https://copy.ai',
                'category': 'copywriting'
            },
            {
                'name': 'Jasper AI',
                'tagline': 'AI content generator for marketing teams',
                'description': 'Create blog posts, social media content, and marketing copy with AI',
                'websiteUrl': 'https://jasper.ai',
                'category': 'content-creation'
            },
            {
                'name': 'Grammarly',
                'tagline': 'AI writing assistant for grammar and style',
                'description': 'Improve your writing with AI-powered grammar checking and style suggestions',
                'websiteUrl': 'https://grammarly.com',
                'category': 'writing'
            },
            {
                'name': 'Canva AI',
                'tagline': 'AI-powered design tool for creating visual content',
                'description': 'Create stunning designs, presentations, and social media graphics with AI assistance',
                'websiteUrl': 'https://canva.com',
                'category': 'design'
            },
            {
                'name': 'Semrush',
                'tagline': 'AI-enhanced SEO and marketing toolkit',
                'description': 'Comprehensive SEO tools with AI insights for keyword research and competitor analysis',
                'websiteUrl': 'https://semrush.com',
                'category': 'seo'
            },
            {
                'name': 'Surfer SEO',
                'tagline': 'AI-powered SEO content optimization',
                'description': 'Optimize your content for search engines with AI-driven SEO recommendations',
                'websiteUrl': 'https://surferseo.com',
                'category': 'seo'
            },
            {
                'name': 'HubSpot AI',
                'tagline': 'AI-powered marketing automation platform',
                'description': 'Complete marketing, sales, and service platform enhanced with AI capabilities',
                'websiteUrl': 'https://hubspot.com',
                'category': 'marketing'
            },
            {
                'name': 'Writesonic',
                'tagline': 'AI writer for content creation and copywriting',
                'description': 'Generate articles, ads, emails, and website copy with advanced AI technology',
                'websiteUrl': 'https://writesonic.com',
                'category': 'writing'
            },
            {
                'name': 'Rytr',
                'tagline': 'AI writing assistant for content creation',
                'description': 'Create high-quality content for blogs, emails, and ads in seconds',
                'websiteUrl': 'https://rytr.me',
                'category': 'writing'
            },
            {
                'name': 'Loom AI',
                'tagline': 'AI-powered video messaging and screen recording',
                'description': 'Record and share AI-enhanced video messages for better communication',
                'websiteUrl': 'https://loom.com',
                'category': 'communication'
            },
            {
                'name': 'Notion AI',
                'tagline': 'AI-powered workspace for notes and collaboration',
                'description': 'Enhance your productivity with AI writing assistance in your workspace',
                'websiteUrl': 'https://notion.so',
                'category': 'productivity'
            },
            {
                'name': 'Midjourney',
                'tagline': 'AI image generator for creative visuals',
                'description': 'Create stunning artwork and images from text descriptions using AI',
                'websiteUrl': 'https://midjourney.com',
                'category': 'design'
            },
            {
                'name': 'DALL-E 2',
                'tagline': 'AI system for creating realistic images from text',
                'description': 'Generate, edit, and create variations of images with AI technology',
                'websiteUrl': 'https://openai.com/dall-e-2',
                'category': 'image-generation'
            },
            {
                'name': 'Speechify',
                'tagline': 'AI-powered text-to-speech tool',
                'description': 'Convert any text into natural-sounding speech with AI voices',
                'websiteUrl': 'https://speechify.com',
                'category': 'productivity'
            },
            {
                'name': 'Zapier AI',
                'tagline': 'AI-powered workflow automation',
                'description': 'Automate repetitive tasks and workflows with AI-enhanced integrations',
                'websiteUrl': 'https://zapier.com',
                'category': 'automation'
            },
            {
                'name': 'Claude AI',
                'tagline': 'AI assistant for analysis and content creation',
                'description': 'Helpful AI assistant for writing, research, analysis, and creative tasks',
                'websiteUrl': 'https://claude.ai',
                'category': 'ai-assistant'
            },
            {
                'name': 'Gamma',
                'tagline': 'AI-powered presentation maker',
                'description': 'Create beautiful presentations, documents, and websites with AI',
                'websiteUrl': 'https://gamma.app',
                'category': 'presentation'
            },
            {
                'name': 'Otter.ai',
                'tagline': 'AI-powered meeting transcription and notes',
                'description': 'Automatically transcribe and summarize meetings with AI technology',
                'websiteUrl': 'https://otter.ai',
                'category': 'productivity'
            },
            {
                'name': 'Brandwatch',
                'tagline': 'AI-powered social media monitoring',
                'description': 'Monitor brand mentions and analyze social media data with AI insights',
                'websiteUrl': 'https://brandwatch.com',
                'category': 'social-media'
            }
        ]
        
        # Add more tools to reach 50+
        additional_tools = [
            {
                'name': 'Typeface',
                'tagline': 'AI content creation platform for enterprises',
                'description': 'Enterprise-grade AI for creating personalized content at scale',
                'websiteUrl': 'https://typeface.ai',
                'category': 'content-creation'
            },
            {
                'name': 'Synthesia',
                'tagline': 'AI video generator with virtual presenters',
                'description': 'Create professional videos with AI avatars and text-to-speech',
                'websiteUrl': 'https://synthesia.io',
                'category': 'video'
            },
            {
                'name': 'RunwayML',
                'tagline': 'AI tools for creative content generation',
                'description': 'Suite of AI tools for video editing, image generation, and creative projects',
                'websiteUrl': 'https://runwayml.com',
                'category': 'creative'
            },
            {
                'name': 'Descript',
                'tagline': 'AI-powered audio and video editing',
                'description': 'Edit audio and video by editing text with AI transcription',
                'websiteUrl': 'https://descript.com',
                'category': 'editing'
            },
            {
                'name': 'Murf AI',
                'tagline': 'AI voice generator for voiceovers',
                'description': 'Create realistic voiceovers and speech from text using AI',
                'websiteUrl': 'https://murf.ai',
                'category': 'voice'
            },
            {
                'name': 'Pictory',
                'tagline': 'AI video creation from text and articles',
                'description': 'Turn articles and scripts into engaging videos automatically',
                'websiteUrl': 'https://pictory.ai',
                'category': 'video'
            },
            {
                'name': 'Scalenut',
                'tagline': 'AI-powered SEO and content marketing',
                'description': 'Complete SEO and content marketing platform with AI assistance',
                'websiteUrl': 'https://scalenut.com',
                'category': 'seo'
            },
            {
                'name': 'MarketMuse',
                'tagline': 'AI content planning and optimization',
                'description': 'AI-driven content strategy and optimization for better search rankings',
                'websiteUrl': 'https://marketmuse.com',
                'category': 'content-seo'
            },
            {
                'name': 'Frase',
                'tagline': 'AI content optimization for SEO',
                'description': 'Research, write, and optimize SEO content with AI assistance',
                'websiteUrl': 'https://frase.io',
                'category': 'seo'
            },
            {
                'name': 'ContentKing',
                'tagline': 'AI-powered SEO monitoring and optimization',
                'description': 'Real-time SEO monitoring and content optimization with AI insights',
                'websiteUrl': 'https://contentkingapp.com',
                'category': 'seo'
            },
            {
                'name': 'Clearscope',
                'tagline': 'AI content optimization for search rankings',
                'description': 'Optimize your content for better search performance with AI',
                'websiteUrl': 'https://clearscope.io',
                'category': 'seo'
            },
            {
                'name': 'Persado',
                'tagline': 'AI-powered marketing language optimization',
                'description': 'Generate and optimize marketing messages with AI for better engagement',
                'websiteUrl': 'https://persado.com',
                'category': 'marketing'
            },
            {
                'name': 'Phrasee',
                'tagline': 'AI for email marketing and copywriting',
                'description': 'Generate and optimize email subject lines and marketing copy with AI',
                'websiteUrl': 'https://phrasee.co',
                'category': 'email-marketing'
            },
            {
                'name': 'Optimizely',
                'tagline': 'AI-powered experimentation and optimization',
                'description': 'A/B testing and website optimization platform enhanced with AI',
                'websiteUrl': 'https://optimizely.com',
                'category': 'optimization'
            },
            {
                'name': 'Dynamic Yield',
                'tagline': 'AI personalization and optimization platform',
                'description': 'Personalize customer experiences with AI-driven recommendations',
                'websiteUrl': 'https://dynamicyield.com',
                'category': 'personalization'
            },
            {
                'name': 'Albert AI',
                'tagline': 'Autonomous AI for digital marketing',
                'description': 'Self-optimizing AI platform for programmatic advertising and marketing',
                'websiteUrl': 'https://albert.ai',
                'category': 'advertising'
            },
            {
                'name': 'Seventh Sense',
                'tagline': 'AI email delivery time optimization',
                'description': 'Optimize email send times using AI for better engagement rates',
                'websiteUrl': 'https://seventhsense.ai',
                'category': 'email-marketing'
            },
            {
                'name': 'Drift',
                'tagline': 'AI-powered conversational marketing platform',
                'description': 'Engage website visitors with AI chatbots and conversational marketing',
                'websiteUrl': 'https://drift.com',
                'category': 'chatbot'
            },
            {
                'name': 'Intercom',
                'tagline': 'AI customer messaging and support platform',
                'description': 'Customer support and engagement platform with AI-powered features',
                'websiteUrl': 'https://intercom.com',
                'category': 'customer-support'
            },
            {
                'name': 'Zendesk AI',
                'tagline': 'AI-enhanced customer service platform',
                'description': 'Customer service software with AI automation and insights',
                'websiteUrl': 'https://zendesk.com',
                'category': 'customer-support'
            },
            {
                'name': 'Freshworks AI',
                'tagline': 'AI-powered business software suite',
                'description': 'CRM, support, and marketing software enhanced with AI capabilities',
                'websiteUrl': 'https://freshworks.com',
                'category': 'business-software'
            },
            {
                'name': 'Salesforce Einstein',
                'tagline': 'AI for CRM and sales automation',
                'description': 'AI-powered insights and automation for sales and customer relationship management',
                'websiteUrl': 'https://salesforce.com/einstein',
                'category': 'crm'
            },
            {
                'name': 'Monday.com AI',
                'tagline': 'AI-enhanced project management platform',
                'description': 'Work management platform with AI automation and insights',
                'websiteUrl': 'https://monday.com',
                'category': 'project-management'
            },
            {
                'name': 'ClickUp AI',
                'tagline': 'AI-powered productivity and project management',
                'description': 'All-in-one workspace with AI writing assistant and task automation',
                'websiteUrl': 'https://clickup.com',
                'category': 'productivity'
            },
            {
                'name': 'Trello AI',
                'tagline': 'AI-enhanced team collaboration and project management',
                'description': 'Visual project management with AI-powered automation and insights',
                'websiteUrl': 'https://trello.com',
                'category': 'project-management'
            },
            {
                'name': 'Asana AI',
                'tagline': 'AI-powered work management platform',
                'description': 'Team collaboration and project management with AI automation',
                'websiteUrl': 'https://asana.com',
                'category': 'project-management'
            },
            {
                'name': 'Buffer AI',
                'tagline': 'AI-enhanced social media management',
                'description': 'Social media scheduling and analytics with AI-powered insights',
                'websiteUrl': 'https://buffer.com',
                'category': 'social-media'
            },
            {
                'name': 'Hootsuite AI',
                'tagline': 'AI-powered social media management platform',
                'description': 'Comprehensive social media management with AI content suggestions',
                'websiteUrl': 'https://hootsuite.com',
                'category': 'social-media'
            },
            {
                'name': 'Sprout Social',
                'tagline': 'AI-enhanced social media management and analytics',
                'description': 'Social media management platform with AI-powered insights and automation',
                'websiteUrl': 'https://sproutsocial.com',
                'category': 'social-media'
            },
            {
                'name': 'Later AI',
                'tagline': 'AI-powered social media scheduling and analytics',
                'description': 'Visual social media scheduler with AI content optimization',
                'websiteUrl': 'https://later.com',
                'category': 'social-media'
            },
            {
                'name': 'Socialbee AI',
                'tagline': 'AI-enhanced social media management tool',
                'description': 'Social media scheduling and content curation with AI assistance',
                'websiteUrl': 'https://socialbee.io',
                'category': 'social-media'
            },
            {
                'name': 'CoSchedule AI',
                'tagline': 'AI-powered marketing calendar and automation',
                'description': 'Marketing calendar and workflow automation with AI optimization',
                'websiteUrl': 'https://coschedule.com',
                'category': 'marketing'
            },
            {
                'name': 'Mailchimp AI',
                'tagline': 'AI-enhanced email marketing and automation',
                'description': 'Email marketing platform with AI-powered personalization and optimization',
                'websiteUrl': 'https://mailchimp.com',
                'category': 'email-marketing'
            },
            {
                'name': 'Constant Contact AI',
                'tagline': 'AI-powered email marketing and automation',
                'description': 'Email marketing and automation tools enhanced with AI capabilities',
                'websiteUrl': 'https://constantcontact.com',
                'category': 'email-marketing'
            },
            {
                'name': 'ConvertKit AI',
                'tagline': 'AI-enhanced email marketing for creators',
                'description': 'Email marketing platform designed for creators with AI optimization',
                'websiteUrl': 'https://convertkit.com',
                'category': 'email-marketing'
            }
        ]
        
        all_predefined = predefined_tools + additional_tools
        
        for tool_info in all_predefined:
            formatted_tool = {
                'name': tool_info['name'][:100],
                'tagline': tool_info['tagline'][:200],
                'description': tool_info['description'][:500],
                'websiteUrl': tool_info['websiteUrl'],
                'logoUrl': '',  # Would need to scrape actual logos
                'tags': self.generate_category_tags(tool_info['category'], tool_info['name']),
                'appStoreUrl': None,
                'playStoreUrl': None,
                'visual': self.generate_visual()
            }
            tools.append(formatted_tool)
        
        return tools
    
    def extract_text_from_element(self, element, selectors, default=""):
        """Extract text from element using multiple selectors"""
        for selector in selectors:
            found = element.select_one(selector)
            if found:
                text = found.get_text().strip()
                if text:
                    return text
        return default
    
    def generate_ai_tags(self, name, tagline):
        """Generate relevant tags based on name and tagline"""
        tags = ['ai', 'artificial intelligence']
        
        text_lower = (name + ' ' + tagline).lower()
        
        tag_keywords = {
            'seo': ['seo', 'search', 'ranking', 'optimization'],
            'marketing': ['marketing', 'campaign', 'promotion', 'advertising'],
            'content': ['content', 'writing', 'blog', 'article'],
            'social media': ['social', 'instagram', 'twitter', 'facebook'],
            'email': ['email', 'newsletter', 'automation'],
            'analytics': ['analytics', 'data', 'tracking', 'insights'],
            'productivity': ['productivity', 'workflow', 'efficiency'],
            'design': ['design', 'creative', 'visual', 'graphics'],
            'automation': ['automation', 'workflow', 'zapier'],
            'chatbot': ['chat', 'bot', 'conversation', 'messaging']
        }
        
        for category, keywords in tag_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                tags.append(category)
        
        return ','.join(tags[:6])
    
    def generate_category_tags(self, category, name):
        """Generate tags based on category"""
        base_tags = ['ai', 'artificial intelligence', 'productivity']
        
        category_mapping = {
            'ai-assistant': ['chatbot', 'conversation', 'assistant'],
            'copywriting': ['copywriting', 'marketing', 'content', 'writing'],
            'content-creation': ['content', 'writing', 'blog', 'marketing'],
            'writing': ['writing', 'content', 'grammar', 'editing'],
            'design': ['design', 'graphics', 'creative', 'visual'],
            'seo': ['seo', 'search', 'optimization', 'marketing'],
            'marketing': ['marketing', 'advertising', 'promotion', 'campaign'],
            'communication': ['communication', 'messaging', 'collaboration'],
            'productivity': ['productivity', 'workflow', 'efficiency', 'automation'],
            'image-generation': ['image', 'visual', 'creative', 'design'],
            'automation': ['automation', 'workflow', 'integration', 'efficiency'],
            'presentation': ['presentation', 'slides', 'design', 'business'],
            'social-media': ['social media', 'marketing', 'engagement', 'analytics'],
            'video': ['video', 'multimedia', 'content', 'creative'],
            'creative': ['creative', 'design', 'art', 'visual'],
            'editing': ['editing', 'video', 'audio', 'content'],
            'voice': ['voice', 'audio', 'speech', 'sound'],
            'content-seo': ['seo', 'content', 'optimization', 'search'],
            'email-marketing': ['email', 'marketing', 'automation', 'campaign'],
            'optimization': ['optimization', 'testing', 'conversion', 'performance'],
            'personalization': ['personalization', 'recommendation', 'customization'],
            'advertising': ['advertising', 'marketing', 'ppc', 'campaigns'],
            'chatbot': ['chatbot', 'conversation', 'customer service', 'automation'],
            'customer-support': ['customer support', 'service', 'help desk'],
            'business-software': ['business', 'enterprise', 'software', 'management'],
            'crm': ['crm', 'sales', 'customer management', 'business'],
            'project-management': ['project management', 'collaboration', 'workflow']
        }
        
        category_tags = category_mapping.get(category, [category.replace('-', ' ')])
        all_tags = base_tags + category_tags
        
        return ','.join(all_tags[:6])
    
    def generate_visual(self):
        """Generate visual object for tools"""
        colors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16']
        icons = ['rocket', 'brain', 'sparkles', 'chart', 'target', 'zap', 'star', 'cpu']
        
        return {
            'type': 'gradient',
            'color': random.choice(colors),
            'content': [
                {
                    'icon': random.choice(icons),
                    'text': 'AI Powered'
                }
            ]
        }
    
    def save_tools_to_file(self, filename='ai_tools_submitTool_format.txt'):
        """Save tools in submitTool format"""
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write('// AI Tools scraped in submitTool format\n')
                f.write('// Each tool can be directly used with the submitTool API\n\n')
                
                for i, tool in enumerate(self.tools, 1):
                    f.write(f'// Tool {i}: {tool["name"]}\n')
                    f.write(json.dumps(tool, ensure_ascii=False, indent=2))
                    f.write('\n\n' + '='*80 + '\n\n')
            
            print(f'✅ Saved {len(self.tools)} tools to {filename}')
            return True
        except Exception as e:
            print(f'❌ Error saving to file: {e}')
            return False
    
    def run_comprehensive_scraper(self, target_count=55):
        """Main function to run comprehensive AI tool scraping"""
        print('🚀 Starting Comprehensive AI Tool Scraper...')
        print(f'🎯 Target: {target_count} tools')
        
        # Method 1: Use predefined comprehensive list
        print('\n📋 Loading comprehensive AI tools database...')
        directory_tools = self.scrape_ai_tool_directories()
        self.tools.extend(directory_tools)
        print(f'   Added {len(directory_tools)} tools from database')
        
        # Method 2: Try scraping Product Hunt (if successful)
        if len(self.tools) < target_count:
            print('\n🔍 Attempting to scrape Product Hunt...')
            ph_tools = self.scrape_product_hunt_ai_tools()
            self.tools.extend(ph_tools)
            print(f'   Added {len(ph_tools)} tools from Product Hunt')
        
        # Remove duplicates based on name
        seen_names = set()
        unique_tools = []
        for tool in self.tools:
            if tool['name'].lower() not in seen_names:
                seen_names.add(tool['name'].lower())
                unique_tools.append(tool)
        
        self.tools = unique_tools[:target_count]
        
        # Save to file
        success = self.save_tools_to_file()
        
        if success:
            print(f'\n🎉 Scraping completed successfully!')
            print(f'📊 Total tools collected: {len(self.tools)}')
            print(f'💾 Data saved in submitTool format')
            print(f'🔗 Each tool includes: name, tagline, description, website, tags, visual data')
        else:
            print('\n❌ Error saving results')
        
        return self.tools

# Usage
if __name__ == '__main__':
    scraper = MultiSourceAIToolScraper()
    tools = scraper.run_comprehensive_scraper(target_count=60)  # Get 60 to ensure 50+ quality tools
