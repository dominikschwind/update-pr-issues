const START_MARKER = '<!-- referenced-issues:start -->';
const END_MARKER = '<!-- referenced-issues:end -->';

/**
 * Extracts unique issue numbers from commit messages.
 * Matches: #1234 and (#1234)
 */
function extractIssueNumbers(commitMessages) {
  const pattern = /\(?#(\d+)\)?/g;
  const issues = new Set();

  for (const message of commitMessages) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      issues.add(parseInt(match[1], 10));
    }
  }

  return [...issues].sort((a, b) => a - b);
}

/**
 * Builds the managed markdown section from a list of issue numbers.
 */
function buildSection(issueNumbers) {
  const content = issueNumbers.length > 0
    ? issueNumbers.map(n => `* #${n}`).join('\n')
    : '_No issue references found in commits._';

  return `${START_MARKER}\n## Referenced Issues\n\n${content}\n${END_MARKER}`;
}

/**
 * Replaces or appends the managed section in an existing PR body.
 */
function updateBody(currentBody, newSection) {
  if (currentBody.includes(START_MARKER)) {
    const pattern = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`, 'g');
    return currentBody.replace(pattern, newSection);
  }
  return currentBody ? `${currentBody}\n\n${newSection}` : newSection;
}

module.exports = { extractIssueNumbers, buildSection, updateBody, START_MARKER, END_MARKER };
