const { extractIssueNumbers, buildSection, updateBody } = require('./helpers');

describe('extractIssueNumbers', () => {
  test('extracts bare issue references', () => {
    expect(extractIssueNumbers(['added feature #1234'])).toEqual([1234]);
  });

  test('extracts parenthesised issue references', () => {
    expect(extractIssueNumbers(['fixed bug (#1235)'])).toEqual([1235]);
  });

  test('extracts multiple issues from one message', () => {
    expect(extractIssueNumbers(['relates to #10 and (#20)'])).toEqual([10, 20]);
  });

  test('deduplicates across multiple commits', () => {
    expect(extractIssueNumbers(['fix #99', 'also #99', 'and (#100)'])).toEqual([99, 100]);
  });

  test('returns sorted results', () => {
    expect(extractIssueNumbers(['#300 and #100 and #200'])).toEqual([100, 200, 300]);
  });

  test('returns empty array when no issues found', () => {
    expect(extractIssueNumbers(['just a regular commit message'])).toEqual([]);
  });

  test('ignores GH- style references', () => {
    expect(extractIssueNumbers(['GH-1234 some fix'])).toEqual([]);
  });

  test('ignores closes/fixes keywords without #', () => {
    expect(extractIssueNumbers(['fixes 1234'])).toEqual([]);
  });
});

describe('buildSection', () => {
  test('builds bullet list for found issues', () => {
    const section = buildSection([1234, 1235]);
    expect(section).toContain('* #1234');
    expect(section).toContain('* #1235');
    expect(section).toContain('<!-- referenced-issues:start -->');
    expect(section).toContain('<!-- referenced-issues:end -->');
  });

  test('shows fallback message when no issues', () => {
    const section = buildSection([]);
    expect(section).toContain('_No issue references found in commits._');
  });
});

describe('updateBody', () => {
  test('appends section when no markers present', () => {
    const result = updateBody('My PR description', '<!-- referenced-issues:start -->\ncontent\n<!-- referenced-issues:end -->');
    expect(result).toContain('My PR description');
    expect(result).toContain('content');
  });

  test('replaces existing managed section', () => {
    const existing = 'Intro\n\n<!-- referenced-issues:start -->\nold content\n<!-- referenced-issues:end -->';
    const result = updateBody(existing, '<!-- referenced-issues:start -->\nnew content\n<!-- referenced-issues:end -->');
    expect(result).toContain('new content');
    expect(result).not.toContain('old content');
    expect(result).toContain('Intro');
  });

  test('handles empty current body', () => {
    const result = updateBody('', '<!-- referenced-issues:start -->\ncontent\n<!-- referenced-issues:end -->');
    expect(result).toContain('content');
  });
});
