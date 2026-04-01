const core = require('@actions/core');
const { extractIssueNumbers, buildSection, updateBody } = require('./helpers');

async function run() {
  // @actions/github v9 is ESM-only, so we dynamic import it
  const { getOctokit, context } = await import('@actions/github');

  const token = core.getInput('github-token', { required: true });
  const octokit = getOctokit(token);
  const { owner, repo } = context.repo;

  let prNumber;

  if (context.eventName === 'pull_request') {
    prNumber = context.payload.pull_request.number;
  } else if (context.eventName === 'push') {
    const branch = context.ref.replace('refs/heads/', '');
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
  } else {
    core.setFailed(`Unsupported event: ${context.eventName}`);
    return;
  }

  core.info(`Processing PR #${prNumber}`);

  const { data: commits } = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  const messages = commits.map(c => c.commit.message);
  core.info(`Found ${messages.length} commits`);

  const issueNumbers = extractIssueNumbers(messages);
  core.info(`Extracted issue numbers: ${issueNumbers.join(', ') || 'none'}`);

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