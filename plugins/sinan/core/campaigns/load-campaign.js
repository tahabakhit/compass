'use strict';

const fs = require('fs');
const path = require('path');
const { parseCampaignContent } = require('./parse-campaign');

function getProjectRoot(projectRoot) {
  return projectRoot || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function getCampaignPaths(projectRoot) {
  const root = getProjectRoot(projectRoot);
  const campaignsDir = path.join(root, '.planning', 'campaigns');
  return {
    root,
    campaignsDir,
    completedDir: path.join(campaignsDir, 'completed'),
  };
}

function readCampaignFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const slug = path.basename(filePath, '.md');
  return {
    ...parseCampaignContent(content, { slug }),
    filePath,
  };
}

function listCampaignFiles(projectRoot, options = {}) {
  const paths = getCampaignPaths(projectRoot);
  const includeCompleted = options.includeCompleted === true;
  const files = [];

  if (fs.existsSync(paths.campaignsDir)) {
    for (const entry of fs.readdirSync(paths.campaignsDir)) {
      const fullPath = path.join(paths.campaignsDir, entry);
      if (entry.endsWith('.md') && fs.statSync(fullPath).isFile()) files.push(fullPath);
    }
  }

  if (includeCompleted && fs.existsSync(paths.completedDir)) {
    for (const entry of fs.readdirSync(paths.completedDir)) {
      const fullPath = path.join(paths.completedDir, entry);
      if (entry.endsWith('.md') && fs.statSync(fullPath).isFile()) files.push(fullPath);
    }
  }

  return files.sort();
}

function listCampaigns(projectRoot, options = {}) {
  return listCampaignFiles(projectRoot, options).map(readCampaignFile);
}

function findActiveCampaign(projectRoot) {
  return listCampaigns(projectRoot).find(campaign => {
    return campaign.frontmatter.status === 'active' || campaign.bodyStatus === 'active';
  }) || null;
}

function readCampaignStats(projectRoot) {
  const paths = getCampaignPaths(projectRoot);
  const active = listCampaigns(projectRoot)
    .filter(campaign => campaign.filePath.startsWith(paths.campaignsDir))
    .map(campaign => campaign.slug);

  const completedCount = fs.existsSync(paths.completedDir)
    ? fs.readdirSync(paths.completedDir).filter(entry => entry.endsWith('.md')).length
    : 0;

  return {
    active,
    completed_count: completedCount,
  };
}

module.exports = {
  findActiveCampaign,
  getCampaignPaths,
  getProjectRoot,
  listCampaignFiles,
  listCampaigns,
  readCampaignFile,
  readCampaignStats,
};
