const core = require('@actions/core');
const github = require('@actions/github');

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

async function run() {
  const token = core.getInput('github-token', { required: true });
  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;

  // Resolve PR number — present on pull_request events, needs lookup on push
  let prNumber;
  let baseSha;

  if (github.context.eventName === 'pull_request') {
    prNumber = github.context.payload.pull_request.number;
    baseSha = github.context.payload.pull_request.base.sha;
  } else if (github.context.eventName === 'push') {
    const branch = github.context.ref.replace('refs/heads/', '');
    core.info(`Looking for open PR on branch: ${branch}`);

    const { data: prs } = await octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${branch}`,
      state: 'open',
    });

    if (prs.length === 0) {
      core.info('No open PR found for this branch. Skipping.');
      return;
    }

    prNumber = prs[0].number;
    baseSha = prs[0].base.sha;
  } else {
    core.setFailed(`Unsupported event: ${github.context.eventName}`);
    return;
  }

  core.info(`Processing PR #${prNumber} (base: ${baseSha})`);

  // Fetch commits on this PR
  const { data: commits } = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  const messages = commits.map(c => c.commit.message);
  core.info(`Found ${messages.length} commits`);
  core.debug(`Commit messages:\n${messages.join('\n')}`);

  const issueNumbers = extractIssueNumbers(messages);
  core.info(`Extracted issue numbers: ${issueNumbers.join(', ') || 'none'}`);

  // Fetch current PR body
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  const currentBody = pr.body || '';
  const newSection = buildSection(issueNumbers);
  const newBody = updateBody(currentBody, newSection);

  if (newBody === currentBody) {
    core.info('PR description is already up to date. Skipping update.');
    return;
  }

  await octokit.rest.pulls.update({
    owner,
    repo,
    pull_number: prNumber,
    body: newBody,
  });

  core.info(`✅ PR #${prNumber} description updated.`);
  core.setOutput('pr-number', prNumber);
  core.setOutput('issues-found', issueNumbers.join(','));
}

run().catch(err => core.setFailed(err.message));

// Export pure functions for unit testing
if (process.env.NODE_ENV === 'test') {
  module.exports = { extractIssueNumbers, buildSection, updateBody };
}
