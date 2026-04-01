import * as core from '@actions/core';
import * as github from '@actions/github';
import { extractIssueNumbers, buildSection, updateBody } from './helpers.js';

async function run() {
  const token = core.getInput('github-token', { required: true });
  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;

  let prNumber;

  if (github.context.eventName === 'pull_request') {
    prNumber = github.context.payload.pull_request.number;
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
  } else {
    core.setFailed(`Unsupported event: ${github.context.eventName}`);
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
