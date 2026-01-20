# Code Reviewer Skill

## Description
Use this skill when the user asks for a "Review" or when you are about to finalize a pull request. It strictly enforces code quality standards.

## Goal
Analyze the current diff against industry best practices and security vulnerabilities.

## Instructions
1.  **Scan Context:** Read all modified files in the git staging area.
2.  **Security Check:** Look specifically for:
    - Hardcoded secrets.
    - SQL injection vulnerabilities.
    - Unsanitized inputs.
3.  **Performance Check:** Identify nested loops or N+1 query problems.
4.  **Report Generation:**
    - Do NOT fix the code yet.
    - Generate a markdown report `REVIEW_REPORT.md` categorized by "Critical", "Major", and "Nitpick".
5.  **Constraints:**
    - Be harsh. Do not compliment the code. Focus only on errors.

## Examples
User: "I'm done with the auth module. Check it."
Agent: [Invokes Code Reviewer Skill] -> Generates strict report.