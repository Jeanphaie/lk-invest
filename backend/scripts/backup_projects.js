const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany();
  fs.writeFileSync('backup_projects.json', JSON.stringify(projects, null, 2));
  console.log('Backup done: backup_projects.json');
  // Sauvegarde la table DVF si elle existe :
  const dvfs = await prisma.dVF.findMany();
  fs.writeFileSync('backup_dvf.json', JSON.stringify(dvfs, null, 2));
  console.log('Backup done: backup_dvf.json');
}

main().finally(() => prisma.$disconnect()); 