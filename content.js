// Enhanced extraction (same as basic now that basic works)
function extractPropertyDataEnhanced() {
    console.log('=== ENHANCED EXTRACTION CALLED ===');
    return extractPropertyData();
}

// Enhanced price extraction function - much more reliable
function extractPriceRobust(hostname) {
    console.log('=== ROBUST PRICE EXTRACTION ===');
    
    let price = null;
    
    // Method 1: Site-specific DOM selectors (most reliable)
    price = extractPriceFromSelectors(hostname);
    if (price) {
        console.log('✅ Price found via selectors:', price);
        return price;
    }
    
    // Method 2: JSON-LD structured data
    price = extractPriceFromJsonLd();
    if (price) {
        console.log('✅ Price found via JSON-LD:', price);
        return price;
    }
    
    // Method 3: Meta tags
    price = extractPriceFromMeta();
    if (price) {
        console.log('✅ Price found via meta tags:', price);
        return price;
    }
    
    // Method 4: Enhanced text pattern matching
    price = extractPriceFromText();
    if (price) {
        console.log('✅ Price found via enhanced text patterns:', price);
        return price;
    }
    
    // Method 5: DOM tree traversal for price elements
    price = extractPriceFromDomTraversal();
    if (price) {
        console.log('✅ Price found via DOM traversal:', price);
        return price;
    }
    
    console.log('❌ No price found with any method');
    return null;
}

function extractPriceFromSelectors(hostname) {
    console.log('Trying site-specific selectors...');
    
    let selectors = [];
    
    if (hostname.includes('zillow.com')) {
        selectors = [
            '[data-testid="price"]',
            '.ds-price .ds-text',
            '.ds-summary-row .ds-price',
            '.price',
            '.notranslate',
            '[class*="price"]',
            '.ds-price',
            '.zsg-photo-card-price',
            '.zsg-photo-card-info .zsg-photo-card-price',
            'span[class*="Text-c11n-8-84-3__sc-aiai24-0"]', // Zillow's dynamic classes
            'h1[data-testid="price"]',
            '.Text-c11n-8-84-3__sc-aiai24-0'
        ];
    } else if (hostname.includes('realtor.com')) {
        selectors = [
            '[data-testid="price-display"]',
            '.Price',
            '.listing-price',
            '.price-display',
            '.price-wrapper',
            '[class*="price"]',
            '.ldp-header-price',
            '.listing-summary-price'
        ];
    } else if (hostname.includes('redfin.com')) {
        selectors = [
            '.price',
            '.listing-price',
            '.price-display',
            '[data-rf-test-id="price"]',
            '.stats-value',
            '[class*="price"]',
            '.home-stats-price'
        ];
    }
    
    // Try each selector
    for (const selector of selectors) {
        try {
            const elements = document.querySelectorAll(selector);
            console.log(`Trying selector "${selector}": found ${elements.length} elements`);
            
            for (const element of elements) {
                const text = element.textContent || element.innerText || '';
                console.log(`  Element text: "${text}"`);
                
                const price = extractPriceFromString(text);
                if (price && price >= 50000 && price <= 50000000) {
                    console.log(`  ✅ Valid price found: ${price}`);
                    return price;
                }
            }
        } catch (error) {
            console.log(`  Error with selector "${selector}":`, error.message);
        }
    }
    
    return null;
}

function extractPriceFromJsonLd() {
    console.log('Trying JSON-LD structured data...');
    
    try {
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        
        for (const script of jsonLdScripts) {
            try {
                const data = JSON.parse(script.textContent);
                console.log('Found JSON-LD data:', data);
                
                // Check for different price properties
                const priceFields = [
                    'price',
                    'priceRange', 
                    'offers.price',
                    'offers.priceSpecification.price',
                    'listPrice',
                    'askingPrice'
                ];
                
                for (const field of priceFields) {
                    const price = getNestedProperty(data, field);
                    if (price) {
                        const numPrice = extractPriceFromString(price.toString());
                        if (numPrice && numPrice >= 50000 && numPrice <= 50000000) {
                            console.log(`Found price in JSON-LD field "${field}":`, numPrice);
                            return numPrice;
                        }
                    }
                }
            } catch (parseError) {
                console.log('Error parsing JSON-LD:', parseError.message);
            }
        }
    } catch (error) {
        console.log('Error accessing JSON-LD scripts:', error.message);
    }
    
    return null;
}

function extractPriceFromMeta() {
    console.log('Trying meta tags...');
    
    const metaSelectors = [
        'meta[property="og:price:amount"]',
        'meta[property="product:price:amount"]',
        'meta[name="price"]',
        'meta[property="price"]',
        'meta[name="listing:price"]',
        'meta[property="listing:price"]'
    ];
    
    for (const selector of metaSelectors) {
        try {
            const metaTag = document.querySelector(selector);
            if (metaTag) {
                const content = metaTag.getAttribute('content');
                console.log(`Meta tag "${selector}" content:`, content);
                
                if (content) {
                    const price = extractPriceFromString(content);
                    if (price && price >= 50000 && price <= 50000000) {
                        return price;
                    }
                }
            }
        } catch (error) {
            console.log(`Error with meta selector "${selector}":`, error.message);
        }
    }
    
    return null;
}

function extractPriceFromText() {
    console.log('Trying enhanced text pattern matching...');
    
    const pageText = document.body.innerText;
    
    // Enhanced price patterns with more specificity
    const pricePatterns = [
        // Standard dollar amounts
        /\$\s*([\d,]+)(?:\.\d{2})?(?!\s*(?:per|\/|month|year|sqft|sq|ft))/gi,
        // Price with "List Price", "Asking Price", etc.
        /(?:list\s+price|asking\s+price|sale\s+price|price)[:\s]+\$\s*([\d,]+)/gi,
        // Specific real estate formats
        /(?:listed\s+for|priced\s+at)[:\s]+\$\s*([\d,]+)/gi,
        // Dollar amounts at start of line or after certain characters
        /(?:^|[\s\n])\$\s*([\d,]+)(?=\s|$)/gm
    ];
    
    const foundPrices = [];
    
    for (const pattern of pricePatterns) {
        const matches = [...pageText.matchAll(pattern)];
        console.log(`Pattern found ${matches.length} matches:`, pattern);
        
        for (const match of matches) {
            const priceStr = match[1];
            const price = parseInt(priceStr.replace(/,/g, ''));
            
            if (price >= 50000 && price <= 50000000) {
                foundPrices.push({
                    price: price,
                    context: match[0],
                    fullMatch: match.input.substring(Math.max(0, match.index - 50), match.index + 100)
                });
            }
        }
    }
    
    if (foundPrices.length > 0) {
        // Sort by price descending and return the highest reasonable price
        foundPrices.sort((a, b) => b.price - a.price);
        console.log('Found prices from text:', foundPrices.map(p => p.price));
        
        // Look for context clues to identify the main listing price
        for (const priceData of foundPrices) {
            const context = priceData.fullMatch.toLowerCase();
            
            // Prefer prices with listing-related context
            if (context.includes('list') || context.includes('asking') || context.includes('sale') || 
                context.includes('price') || context.includes('home') || context.includes('property')) {
                console.log('Found price with good context:', priceData.price);
                return priceData.price;
            }
        }
        
        // Fallback to highest price
        return foundPrices[0].price;
    }
    
    return null;
}

function extractPriceFromDomTraversal() {
    console.log('Trying DOM traversal for price elements...');
    
    // Look for elements that likely contain prices based on class names, IDs, and content
    const priceIndicators = [
        'price', 'cost', 'amount', 'value', 'listing', 'sale', 'asking'
    ];
    
    const allElements = document.querySelectorAll('*');
    const priceElements = [];
    
    for (const element of allElements) {
        const className = (element.className || '').toLowerCase();
        const id = (element.id || '').toLowerCase();
        const text = (element.textContent || '').trim();
        
        // Check if element likely contains price info
        const hasIndicator = priceIndicators.some(indicator => 
            className.includes(indicator) || id.includes(indicator)
        );
        
        // Check if text looks like a price
        const hasPrice = /\$[\d,]+/.test(text);
        
        if ((hasIndicator || hasPrice) && text.length < 200) {
            const price = extractPriceFromString(text);
            if (price && price >= 50000 && price <= 50000000) {
                priceElements.push({
                    price: price,
                    element: element,
                    className: className,
                    id: id,
                    text: text
                });
            }
        }
    }
    
    if (priceElements.length > 0) {
        // Sort by price and return highest
        priceElements.sort((a, b) => b.price - a.price);
        console.log('Found prices via DOM traversal:', priceElements.map(p => ({ price: p.price, text: p.text })));
        return priceElements[0].price;
    }
    
    return null;
}

function extractPriceFromString(text) {
    if (!text || typeof text !== 'string') return null;
    
    // Remove common non-price text
    const cleanText = text.replace(/(?:per|\/|month|year|sqft|sq\s*ft|square\s*feet)/gi, '');
    
    // Extract number from dollar amount
    const match = cleanText.match(/\$\s*([\d,]+)(?:\.\d{2})?/);
    if (match) {
        const price = parseInt(match[1].replace(/,/g, ''));
        return isNaN(price) ? null : price;
    }
    
    return null;
}

function getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : null;
    }, obj);
}console.log('=== PROPERTY INTELLIGENCE AI CONTENT SCRIPT STARTING ===');

// Ping function - CRITICAL for script detection
function ping() {
    console.log('=== PING RECEIVED ===');
    return { 
        pong: true, 
        timestamp: Date.now(),
        url: window.location.href,
        status: 'content_script_loaded'
    };
}

// Main extraction function
function extractPropertyData() {
    console.log('=== EXTRACTING PROPERTY DATA ===');
    console.log('Current URL:', window.location.href);
    
    let data = {
        price: null,
        bedrooms: null,
        bathrooms: null,
        sqft: null,
        address: null,
        yearBuilt: null,
        pricePerSqft: null,
        propertyAge: null,
        extractedFrom: window.location.hostname,
        timestamp: new Date().toISOString()
    };
    
    try {
        const hostname = window.location.hostname.toLowerCase();
        
        if (hostname.includes('zillow.com')) {
            data = extractZillowData(data);
        } else if (hostname.includes('realtor.com')) {
            data = extractRealtorData(data);
        } else if (hostname.includes('redfin.com')) {
            data = extractRedfinData(data);
        } else {
            console.log('Unsupported site, using generic extraction');
            data = extractGenericData(data);
        }
        
        // Calculate derived values
        if (data.price && data.sqft) {
            data.pricePerSqft = Math.round(data.price / data.sqft);
        }
        
        if (data.yearBuilt) {
            data.propertyAge = new Date().getFullYear() - data.yearBuilt;
        }
        
        console.log('=== EXTRACTION COMPLETE ===');
        console.log('Final data:', data);
        
        return data;
        
    } catch (error) {
        console.error('=== EXTRACTION ERROR ===');
        console.error(error);
        return {
            ...data,
            error: true,
            errorMessage: error.message,
            errorStack: error.stack
        };
    }
}

function extractZillowData(data) {
    console.log('=== EXTRACTING ZILLOW DATA ===');
    
    // Use enhanced robust price extraction
    data.price = extractPriceRobust('zillow.com');
    
    const pageText = document.body.innerText;
    console.log('Page text length:', pageText.length);
    
    // Working bed/bath extraction
    console.log('Attempting to extract bedrooms and bathrooms...');
    const bedMatch = pageText.match(/(\d+)\s*(?:bed|bd|bedroom)/i);
    const bathMatch = pageText.match(/(\d+\.?\d*)\s*(?:bath|ba|bathroom)/i);
    
    if (bedMatch) {
        data.bedrooms = parseInt(bedMatch[1]);
        console.log('✅ Bedrooms found:', data.bedrooms);
    }
    if (bathMatch) {
        data.bathrooms = parseFloat(bathMatch[1]);
        console.log('✅ Bathrooms found:', data.bathrooms);
    }
    
    // Working square footage extraction
    console.log('Attempting to extract square footage...');
    const sqftFinds = [];
    const sqftPatterns = [
        /(\d+,?\d*)\s*sqft/gi,
        /(\d+,?\d*)\s*sq\s*ft/gi,
        /(\d+,?\d*)\s*square\s*feet/gi
    ];
    
    sqftPatterns.forEach((pattern) => {
        const matches = pageText.match(pattern);
        if (matches) {
            matches.forEach(match => {
                const numberMatch = match.match(/(\d+,?\d*)/);
                if (numberMatch) {
                    const number = parseInt(numberMatch[1].replace(/,/g, ''));
                    if (number >= 200 && number <= 50000) { // Reasonable sqft range
                        sqftFinds.push({ number: number, fullText: match });
                    }
                }
            });
        }
    });
    
    // Use the first (largest/most relevant) square footage found
    if (sqftFinds.length > 0) {
        data.sqft = sqftFinds[0].number;
        console.log('✅ Square feet found:', data.sqft, 'from text:', sqftFinds[0].fullText);
    }
    
    // Address extraction - try multiple methods
    console.log('Attempting to extract address...');
    
    // Method 1: Page title
    const title = document.title;
    if (title && title.length > 10 && title.includes(',')) {
        data.address = title.trim();
        console.log('✅ Address from title:', data.address);
    }
    
    // Method 2: H1 element
    if (!data.address) {
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent && h1.textContent.length > 10) {
            data.address = h1.textContent.trim();
            console.log('✅ Address from H1:', data.address);
        }
    }
    
    // Method 3: Address-specific selectors
    if (!data.address) {
        const addressSelectors = [
            '[data-testid="address"]',
            '.street-address',
            '.ds-address-container',
            '.summary-container h1'
        ];
        
        for (const selector of addressSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent && element.textContent.length > 10) {
                data.address = element.textContent.trim();
                console.log('✅ Address from selector:', selector, data.address);
                break;
            }
        }
    }
    
    // Year built extraction
    const yearMatch = pageText.match(/(?:built|year built)\s*:?\s*(\d{4})/i);
    if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        if (year >= 1800 && year <= 2025) {
            data.yearBuilt = year;
            console.log('✅ Year built found:', data.yearBuilt);
        }
    }
    
    return data;
}

function extractRealtorData(data) {
    console.log('=== EXTRACTING REALTOR DATA ===');
    
    // Use enhanced robust price extraction
    data.price = extractPriceRobust('realtor.com');
    
    const pageText = document.body.innerText;
    
    const bedMatch = pageText.match(/(\d+)\s*(?:bed|bd)/i);
    const bathMatch = pageText.match(/(\d+\.?\d*)\s*(?:bath|ba)/i);
    
    if (bedMatch) {
        data.bedrooms = parseInt(bedMatch[1]);
        console.log('✅ Realtor bedrooms:', data.bedrooms);
    }
    if (bathMatch) {
        data.bathrooms = parseFloat(bathMatch[1]);
        console.log('✅ Realtor bathrooms:', data.bathrooms);
    }
    
    // Working square footage extraction
    const sqftFinds = [];
    const sqftPatterns = [
        /(\d+,?\d*)\s*sqft/gi,
        /(\d+,?\d*)\s*sq\s*ft/gi,
        /(\d+,?\d*)\s*square\s*feet/gi
    ];
    
    sqftPatterns.forEach((pattern) => {
        const matches = pageText.match(pattern);
        if (matches) {
            matches.forEach(match => {
                const numberMatch = match.match(/(\d+,?\d*)/);
                if (numberMatch) {
                    const number = parseInt(numberMatch[1].replace(/,/g, ''));
                    if (number >= 200 && number <= 50000) {
                        sqftFinds.push({ number: number, fullText: match });
                    }
                }
            });
        }
    });
    
    if (sqftFinds.length > 0) {
        data.sqft = sqftFinds[0].number;
        console.log('✅ Realtor sqft:', data.sqft);
    }
    
    // Address
    const title = document.title;
    const h1 = document.querySelector('h1');
    
    if (title && title.length > 10) {
        data.address = title.trim();
        console.log('✅ Realtor address found');
    } else if (h1 && h1.textContent && h1.textContent.length > 10) {
        data.address = h1.textContent.trim();
        console.log('✅ Realtor address from H1');
    }
    
    return data;
}

function extractRedfinData(data) {
    console.log('=== EXTRACTING REDFIN DATA ===');
    
    // Use enhanced robust price extraction
    data.price = extractPriceRobust('redfin.com');
    
    const pageText = document.body.innerText;
    
    const bedMatch = pageText.match(/(\d+)\s*(?:bed|bd)/i);
    const bathMatch = pageText.match(/(\d+\.?\d*)\s*(?:bath|ba)/i);
    
    if (bedMatch) data.bedrooms = parseInt(bedMatch[1]);
    if (bathMatch) data.bathrooms = parseFloat(bathMatch[1]);
    
    // Working square footage extraction
    const sqftFinds = [];
    const sqftPatterns = [
        /(\d+,?\d*)\s*sqft/gi,
        /(\d+,?\d*)\s*sq\s*ft/gi,
        /(\d+,?\d*)\s*square\s*feet/gi
    ];
    
    sqftPatterns.forEach((pattern) => {
        const matches = pageText.match(pattern);
        if (matches) {
            matches.forEach(match => {
                const numberMatch = match.match(/(\d+,?\d*)/);
                if (numberMatch) {
                    const number = parseInt(numberMatch[1].replace(/,/g, ''));
                    if (number >= 200 && number <= 50000) {
                        sqftFinds.push({ number: number });
                    }
                }
            });
        }
    });
    
    if (sqftFinds.length > 0) {
        data.sqft = sqftFinds[0].number;
        console.log('✅ Redfin sqft:', data.sqft);
    }
    
    // Address
    const title = document.title;
    const h1 = document.querySelector('h1');
    
    if (title && title.length > 10) {
        data.address = title.trim();
    } else if (h1 && h1.textContent) {
        data.address = h1.textContent.trim();
    }
    
    return data;
}

function extractGenericData(data) {
    console.log('=== EXTRACTING GENERIC DATA ===');
    
    // Use enhanced robust price extraction
    data.price = extractPriceRobust(window.location.hostname);
    
    const pageText = document.body.innerText;
    
    // Generic bed/bath extraction
    const bedMatch = pageText.match(/(\d+)\s*(?:bed|bd|bedroom)/i);
    const bathMatch = pageText.match(/(\d+\.?\d*)\s*(?:bath|ba|bathroom)/i);
    
    if (bedMatch) data.bedrooms = parseInt(bedMatch[1]);
    if (bathMatch) data.bathrooms = parseFloat(bathMatch[1]);
    
    // Generic address
    data.address = document.title || 'Address not found';
    
    return data;
}

// Enhanced extraction (same as basic now that basic works)
function extractPropertyDataEnhanced() {
    console.log('=== ENHANCED EXTRACTION CALLED ===');
    return extractPropertyData();
}

// CRITICAL: Message listener - This is where the error occurs
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('=== CONTENT SCRIPT MESSAGE RECEIVED ===');
    console.log('Request action:', request.action);
    console.log('Full request:', request);
    
    try {
        let response;
        
        if (request.action === 'ping') {
            console.log('Handling ping request...');
            response = ping();
            console.log('Ping response:', response);
            sendResponse(response);
            return true; // Keep message channel open
        } 
        else if (request.action === 'extractPropertyData') {
            console.log('Handling basic extraction request...');
            response = extractPropertyData();
            console.log('Basic extraction response:', response);
            sendResponse(response);
            return true; // Keep message channel open
        } 
        else if (request.action === 'extractPropertyDataEnhanced') {
            console.log('Handling enhanced extraction request...');
            response = extractPropertyDataEnhanced();
            console.log('Enhanced extraction response:', response);
            sendResponse(response);
            return true; // Keep message channel open
        } 
        else {
            console.warn('Unknown action received:', request.action);
            response = { 
                error: true, 
                message: 'Unknown action: ' + request.action,
                availableActions: ['ping', 'extractPropertyData', 'extractPropertyDataEnhanced']
            };
            sendResponse(response);
            return true; // Keep message channel open
        }
        
    } catch (error) {
        console.error('=== MESSAGE HANDLER ERROR ===');
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        const errorResponse = { 
            error: true, 
            message: error.message, 
            stack: error.stack,
            timestamp: new Date().toISOString(),
            url: window.location.href
        };
        
        console.log('Sending error response:', errorResponse);
        sendResponse(errorResponse);
        return true; // Keep message channel open
    }
});

// Script initialization logging
console.log('=== CONTENT SCRIPT SETUP COMPLETE ===');
console.log('Current URL:', window.location.href);
console.log('Document ready state:', document.readyState);
console.log('Content script timestamp:', new Date().toISOString());

// Test the message listener is working
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    console.log('✅ Chrome runtime available, message listener attached');
} else {
    console.error('❌ Chrome runtime not available - extension context may be invalid');
}

// Add a window property to verify script is loaded
window.propertyIntelligenceContentScript = {
    loaded: true,
    timestamp: Date.now(),
    version: '2.0.0'
};

console.log('✅ Content script fully initialized and ready for messages');