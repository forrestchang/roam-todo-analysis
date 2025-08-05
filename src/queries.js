// Query functions for fetching TODO blocks from Roam

// Get local date string (YYYY-MM-DD) in local timezone
export function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Query functions adapted for Roam's native API
export async function getTodoBlocks(status) {
    try {
        console.log(`Fetching ${status} blocks...`);
        
        // Query to find all blocks containing the status marker
        const query = `
            [:find ?uid ?string ?create-time ?edit-time ?page-title
             :where
             [?b :block/uid ?uid]
             [?b :block/string ?string]
             [(clojure.string/includes? ?string "{{[[${status}]]}}")]
             [?b :block/page ?page]
             [?page :node/title ?page-title]
             (or-join [?b ?create-time]
               (and [?b :create/time ?create-time])
               (and [(missing? $ ?b :create/time)]
                    [(ground 0) ?create-time]))
             (or-join [?b ?edit-time]
               (and [?b :edit/time ?edit-time])
               (and [(missing? $ ?b :edit/time)]
                    [(ground 0) ?edit-time]))]
        `;

        // Force fresh query by adding timestamp
        const timestamp = Date.now();
        const results = await window.roamAlphaAPI.q(query);
        console.log(`Found ${results.length} ${status} blocks at ${timestamp}`);
        
        // Log a sample of recent results
        const today = getLocalDateString(new Date());
        const todayResults = results.filter(([,,,editTime]) => {
            if (editTime) {
                const date = getLocalDateString(new Date(editTime));
                return date === today;
            }
            return false;
        });
        console.log(`Today's ${status} blocks:`, todayResults.length);
        
        return results.map(([uid, content, createTime, editTime, pageTitle]) => ({
            uid,
            content,
            createTime: createTime || null,
            editTime: editTime || null,
            pageTitle: pageTitle || "Untitled"
        }));
    } catch (error) {
        console.error(`Error fetching ${status} blocks:`, error);
        return [];
    }
}

// Get total TODO count (including all states)
export async function getTotalTodos() {
    try {
        console.log("Fetching total TODO count...");
        
        const query = `
            [:find (count ?b)
             :where
             [?b :block/string ?string]
             (or [(clojure.string/includes? ?string "{{[[TODO]]}}")]
                 [(clojure.string/includes? ?string "{{[[DOING]]}}")]
                 [(clojure.string/includes? ?string "{{[[DONE]]}}")])
            ]
        `;
        
        const result = await window.roamAlphaAPI.q(query);
        const count = result[0]?.[0] || 0;
        console.log(`Total TODO count: ${count}`);
        return count;
    } catch (error) {
        console.error("Error fetching total TODO count:", error);
        return 0;
    }
}

// Get archived blocks
export async function getArchivedBlocks() {
    try {
        console.log("Fetching ARCHIVED blocks...");
        
        const query = `
            [:find ?uid ?string ?create-time ?edit-time ?page-title
             :where
             [?b :block/uid ?uid]
             [?b :block/string ?string]
             [(clojure.string/includes? ?string "{{[[ARCHIVED]]}}")]
             [?b :block/page ?page]
             [?page :node/title ?page-title]
             (or-join [?b ?create-time]
               (and [?b :create/time ?create-time])
               (and [(missing? $ ?b :create/time)]
                    [(ground 0) ?create-time]))
             (or-join [?b ?edit-time]
               (and [?b :edit/time ?edit-time])
               (and [(missing? $ ?b :edit/time)]
                    [(ground 0) ?edit-time]))]
        `;
        
        const results = await window.roamAlphaAPI.q(query);
        console.log(`Found ${results.length} ARCHIVED blocks`);
        
        return results.map(([uid, content, createTime, editTime, pageTitle]) => ({
            uid,
            content,
            createTime: createTime || null,
            editTime: editTime || null,
            pageTitle: pageTitle || "Untitled"
        }));
    } catch (error) {
        console.error("Error fetching ARCHIVED blocks:", error);
        return [];
    }
}

// Get all task blocks (TODO, DOING, DONE, ARCHIVED) for search
export async function getAllTaskBlocks() {
    try {
        console.log("Fetching all task blocks for search...");
        
        const query = `
            [:find ?uid ?string ?create-time ?edit-time ?page-title ?order
             :where
             [?b :block/uid ?uid]
             [?b :block/string ?string]
             (or [(clojure.string/includes? ?string "{{[[TODO]]}}")]
                 [(clojure.string/includes? ?string "{{[[DOING]]}}")]
                 [(clojure.string/includes? ?string "{{[[DONE]]}}")]
                 [(clojure.string/includes? ?string "{{[[ARCHIVED]]}}")])
             [?b :block/page ?page]
             [?page :node/title ?page-title]
             [?b :block/order ?order]
             (or-join [?b ?create-time]
               (and [?b :create/time ?create-time])
               (and [(missing? $ ?b :create/time)]
                    [(ground 0) ?create-time]))
             (or-join [?b ?edit-time]
               (and [?b :edit/time ?edit-time])
               (and [(missing? $ ?b :edit/time)]
                    [(ground 0) ?edit-time]))]
        `;
        
        const results = await window.roamAlphaAPI.q(query);
        console.log(`Found ${results.length} total task blocks`);
        
        return results.map(([uid, content, createTime, editTime, pageTitle, order]) => ({
            uid,
            content,
            createTime: createTime || null,
            editTime: editTime || null,
            pageTitle: pageTitle || "Untitled",
            order: order || 0
        }));
    } catch (error) {
        console.error("Error fetching all task blocks:", error);
        return [];
    }
}

// Get children blocks for a given parent UID
export async function getChildrenBlocks(parentUid) {
    try {
        const query = `
            [:find ?uid ?string ?order
             :where
             [?parent :block/uid "${parentUid}"]
             [?parent :block/children ?child]
             [?child :block/uid ?uid]
             [?child :block/string ?string]
             [?child :block/order ?order]]
        `;
        
        const results = await window.roamAlphaAPI.q(query);
        
        return results
            .map(([uid, content, order]) => ({
                uid,
                content,
                order: order || 0
            }))
            .sort((a, b) => a.order - b.order);
    } catch (error) {
        console.error("Error fetching children blocks:", error);
        return [];
    }
}