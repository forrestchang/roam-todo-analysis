#!/usr/bin/env node

// Build script to bundle the modular code into a single extension.js file
// This is necessary because Roam extensions don't support ES6 modules

const fs = require('fs');
const path = require('path');

// Read all module files
const modules = {
    queries: fs.readFileSync(path.join(__dirname, 'src/queries.js'), 'utf8'),
    utils: fs.readFileSync(path.join(__dirname, 'src/utils.js'), 'utf8'),
    analytics: fs.readFileSync(path.join(__dirname, 'src/analytics.js'), 'utf8'),
    achievements: fs.readFileSync(path.join(__dirname, 'src/achievements.js'), 'utf8'),
    charts: fs.readFileSync(path.join(__dirname, 'src/charts.js'), 'utf8'),
    uiComponents: fs.readFileSync(path.join(__dirname, 'src/ui-components.js'), 'utf8'),
};

// Remove import/export statements and combine
let bundledCode = `// Todo Analysis Extension - Bundled version
// This extension provides comprehensive analytics for TODO items in Roam Research
// Generated from modular source files

`;

// Process each module to remove imports/exports
Object.entries(modules).forEach(([name, code]) => {
    // Remove import statements
    let processedCode = code.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
    
    // Remove export keywords but keep the functions/constants
    processedCode = processedCode.replace(/^export\s+(async\s+)?(function|const|let|var)\s+/gm, '$1$2 ');
    processedCode = processedCode.replace(/^export\s+\{[^}]+\};?\s*$/gm, '');
    processedCode = processedCode.replace(/^export\s+default\s+/gm, '');
    
    bundledCode += `\n// ========== ${name} module ==========\n`;
    bundledCode += processedCode;
});

// Add the main extension code
bundledCode += `
// ========== Main extension code ==========

// Main extension object
export default {
    onload: ({ extensionAPI }) => {
        console.log("Todo Analysis extension loading...");
        
        // Add topbar button
        const topbar = document.querySelector(".rm-topbar");
        if (topbar) {
            const button = createTopbarButton();
            
            // Find the right place to insert (after the graph icon)
            const graphIcon = topbar.querySelector(".bp3-icon-graph");
            if (graphIcon && graphIcon.parentElement) {
                graphIcon.parentElement.insertAdjacentElement('afterend', button);
            } else {
                // Fallback: add to end of topbar
                topbar.appendChild(button);
            }
            
            console.log("Todo Analysis button added to topbar");
        } else {
            console.warn("Topbar not found - Todo Analysis button not added");
        }
        
        console.log("Todo Analysis extension loaded successfully");
    },
    
    onunload: () => {
        console.log("Todo Analysis extension unloading...");
        
        // Remove topbar button
        const button = document.getElementById("todo-analysis-button");
        if (button) {
            button.remove();
        }
        
        // Remove popup if open
        const popup = document.getElementById(POPUP_ID);
        if (popup) {
            popup.remove();
        }
        
        console.log("Todo Analysis extension unloaded");
    }
};
`;

// Write the bundled file
fs.writeFileSync(path.join(__dirname, 'extension.js'), bundledCode);

console.log('✅ Successfully bundled extension modules into extension.js');
console.log('📦 The extension.js file has been updated with the bundled code');