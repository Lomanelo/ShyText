const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject, withInfoPlist, IOSConfig } = require('expo/config-plugins');

const GROUP = 'ShyTextIntents';
const FILE = 'ShyTextIntents.swift';

function findGroupId(project, name) {
  const groups = project.hash.project.objects.PBXGroup || {};
  for (const [key, group] of Object.entries(groups)) {
    if (group && typeof group === 'object' && group.name === name) return key;
  }
  return null;
}

function withSiriCheckIn(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.CFBundleSpokenName = 'Shy Text';
    mod.modResults.INAlternativeAppNames = [
      {
        INAlternativeAppName: 'Shy Text',
        INAlternativeAppNamePronunciationHint: 'shy text',
      },
    ];
    return mod;
  });

  config = withDangerousMod(config, [
    'ios',
    (mod) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);
      const targetDir = path.join(mod.modRequest.platformProjectRoot, projectName, GROUP);
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(path.join(__dirname, 'siri', FILE), path.join(targetDir, FILE));
      return mod;
    },
  ]);

  config = withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);
    const groupPath = `${projectName}/${GROUP}`;
    const filePath = `${groupPath}/${FILE}`;
    let groupId = findGroupId(project, GROUP);
    if (!groupId) {
      groupId = project.pbxCreateGroup(GROUP, groupPath);
      project.addToPbxGroup(groupId, project.getFirstProject().firstProject.mainGroup);
    }
    if (!project.hasFile(filePath)) {
      project.addSourceFile(FILE, { target: project.getFirstTarget().uuid }, groupId);
    }
    return mod;
  });

  return config;
}

module.exports = withSiriCheckIn;
