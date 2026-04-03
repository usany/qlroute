"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = xmlToJson;
function xmlToJson(xmlString) {
    // Simple XML to JSON parser using regex and string manipulation
    function parseElement(xml) {
        const result = {};
        // Remove XML declaration and comments
        xml = xml.replace(/<\?xml[^>]*\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
        // Extract attributes from opening tag
        const attrMatch = xml.match(/<(\w+)([^>]*?)>/);
        if (!attrMatch)
            return xml.trim();
        const tagName = attrMatch[1];
        const attributes = attrMatch[2];
        // Parse attributes
        if (attributes.trim()) {
            const attrs = {};
            const attrRegex = /(\w+)="([^"]*)"/g;
            let match;
            while ((match = attrRegex.exec(attributes)) !== null) {
                attrs[match[1]] = match[2];
            }
            if (Object.keys(attrs).length > 0) {
                result["@attributes"] = attrs;
            }
        }
        // Extract content between opening and closing tags
        const contentMatch = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`));
        if (!contentMatch) {
            // Self-closing tag or empty
            return result;
        }
        let content = contentMatch[1].trim();
        // Check if content contains child elements
        if (content.includes("<")) {
            // Parse child elements
            const childElements = {};
            const tagRegex = /<(\w+)([^>]*?)>([\s\S]*?)<\/\1>/g;
            let match;
            while ((match = tagRegex.exec(content)) !== null) {
                const childTag = match[1];
                const childContent = match[3];
                const parsedChild = parseElement(`<${childTag}${match[2]}>${childContent}</${childTag}>`);
                if (childElements[childTag]) {
                    if (!Array.isArray(childElements[childTag])) {
                        childElements[childTag] = [childElements[childTag]];
                    }
                    childElements[childTag].push(parsedChild);
                }
                else {
                    childElements[childTag] = parsedChild;
                }
            }
            Object.assign(result, childElements);
        }
        else if (content) {
            // Text content only
            return content;
        }
        return result;
    }
    return parseElement(xmlString);
}
