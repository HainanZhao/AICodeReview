/**
 * Critical instruction recap that appears at the end of every prompt
 */
export const CRITICAL_RECAP = `

🔴 **CRITICAL RECAP - FINAL VERIFICATION BEFORE SUBMITTING:**

**🎯 DECISION PROCESS (FOLLOW EXACTLY):**
For each potential feedback item, ask:
1. Is this exact issue already mentioned in existing comments? → SKIP IT
2. Is this similar to any existing comment topic? → SKIP IT  
3. Is this a genuinely new issue not covered above? → INCLUDE IT
4. When in doubt → SKIP IT (better safe than duplicate)

** Final Checklist (MANDATORY VERIFICATION):**
- ✅ **DUPLICATE CHECK**: Read existing comments and confirmed NO overlaps
- ✅ **ZERO TOLERANCE**: Removed any feedback similar to existing comments
- ✅ Used exact file paths from headers
- ✅ Used exact line numbers from FULL FILE CONTENT
- ✅ Counted suggestion lines correctly (-x+y)
- ✅ **QUALITY GATE**: Only included genuinely NEW and valuable feedback
- ✅ **FINAL DECISION**: If no new issues found, used empty feedback array

**REMEMBER: Empty feedback array with "Code looks good!" summary is PERFECT when existing comments are comprehensive**
`;
