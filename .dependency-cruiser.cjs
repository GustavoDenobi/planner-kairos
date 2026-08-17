/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-no-outer-layers',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: '^src/(application|infrastructure|ui)' },
    },
    {
      name: 'application-no-infra-or-ui',
      severity: 'error',
      from: { path: '^src/application' },
      to: { path: '^src/(infrastructure|ui)' },
    },
    {
      name: 'infrastructure-no-ui',
      severity: 'error',
      from: { path: '^src/infrastructure' },
      to: { path: '^src/ui' },
    },
    {
      name: 'ui-no-infrastructure',
      severity: 'error',
      from: { path: '^src/ui' },
      to: { path: '^src/infrastructure' },
    },
    {
      name: 'supabase-only-in-infrastructure',
      severity: 'error',
      from: {
        path: '^src',
        pathNot: '^src/infrastructure',
      },
      to: {
        dependencyTypes: ['npm'],
        path: '@supabase',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.app.json',
    },
  },
};
