// Separate category collections for Personal and Ignite Company.
// The API also verifies scope for create, rename, delete, and assignments.
export const BANK_CATEGORY_WORKSPACES=Object.freeze({
 business:"Ignite Company",
 personal:"Personal"
});
export function categoriesForWorkspace(categories,scope){
 if(!Object.prototype.hasOwnProperty.call(BANK_CATEGORY_WORKSPACES,scope))return [];
 return (Array.isArray(categories)?categories:[]).filter(category=>category.scope===scope);
}
