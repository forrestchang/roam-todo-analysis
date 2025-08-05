// Todo Analysis Extension - Refactored version
// This extension provides comprehensive analytics for TODO items in Roam Research

import { getTodoBlocks, getTotalTodos } from './src/queries.js';
import { calculateStreakAndAverage, generateTodoAnalytics } from './src/analytics.js';
import { createTopbarButton, displayAnalytics, createPopup } from './src/ui-components.js';

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
        
        // Set up the button click handler
        const button = document.getElementById("todo-analysis-button");
        if (button) {
            button.onclick = async () => {
                // Check if popup already exists
                const POPUP_ID = "todo-analysis-popup";
                if (document.getElementById(POPUP_ID)) return;
                
                const { overlay, content } = createPopup();
                document.body.appendChild(overlay);
                
                // Show loading state
                content.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <div class="bp3-spinner">
                            <div class="bp3-spinner-animation"></div>
                        </div>
                        <div style="margin-top: 16px; color: #5c7080;">Loading analytics...</div>
                    </div>
                `;
                
                // Fetch data and generate analytics
                try {
                    const [doneBlocks, totalTodos] = await Promise.all([
                        getTodoBlocks("DONE"),
                        getTotalTodos()
                    ]);
                    
                    const { streak, dailyAverage, dailyCounts } = calculateStreakAndAverage(doneBlocks);
                    const analytics = generateTodoAnalytics(doneBlocks);
                    analytics.streak = streak;
                    analytics.dailyAverage = dailyAverage;
                    analytics.totalTodos = totalTodos;
                    analytics.dailyCounts = dailyCounts;
                    analytics.blocks = doneBlocks;
                    
                    displayAnalytics(content, analytics);
                } catch (error) {
                    console.error("Error loading analytics:", error);
                    content.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #d13913;">
                            <div style="font-size: 18px; margin-bottom: 8px;">Error loading analytics</div>
                            <div style="font-size: 14px; color: #5c7080;">${error.message}</div>
                        </div>
                    `;
                }
            };
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
        const popup = document.getElementById("todo-analysis-popup");
        if (popup) {
            popup.remove();
        }
        
        console.log("Todo Analysis extension unloaded");
    }
};