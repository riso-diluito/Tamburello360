const fs = require('fs');
const path = require('path');

const risultatiDir = path.join(__dirname, '..', 'content', 'risultati');

function fixFrontmatterScores(rawContent) {
  const frontmatterMatch = rawContent.match(/^---\r?\n[\s\S]*?\r?\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[0];
  if (!/^giocata:\s*true\s*$/m.test(frontmatter)) {
    return null;
  }

  const homeMatch = frontmatter.match(/^home_score:[ \t]*([^\r\n]*)$/m);
  const awayMatch = frontmatter.match(/^away_score:[ \t]*([^\r\n]*)$/m);
  if (!homeMatch || !awayMatch) {
    return null;
  }

  const homeScore = homeMatch[1].trim();
  const awayScore = awayMatch[1].trim();

  let updatedFrontmatter = frontmatter;

  if (homeScore === '' && awayScore === '2') {
    updatedFrontmatter = updatedFrontmatter.replace(/^([ \t]*home_score:[ \t]*)(\r?)$/m, (_, prefix, carriageReturn) => `${prefix}0${carriageReturn}`);
  } else if (awayScore === '' && homeScore === '2') {
    updatedFrontmatter = updatedFrontmatter.replace(/^([ \t]*away_score:[ \t]*)(\r?)$/m, (_, prefix, carriageReturn) => `${prefix}0${carriageReturn}`);
  }

  if (updatedFrontmatter === frontmatter) {
    return null;
  }

  return rawContent.replace(frontmatter, updatedFrontmatter);
}

function main() {
  if (!fs.existsSync(risultatiDir)) {
    console.log(`Directory non trovata: ${risultatiDir}`);
    process.exit(0);
  }

  const files = fs.readdirSync(risultatiDir).filter((file) => file.endsWith('.md'));
  const modifiedFiles = [];

  for (const file of files) {
    const filePath = path.join(risultatiDir, file);
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const updatedContent = fixFrontmatterScores(rawContent);

    if (!updatedContent) {
      continue;
    }

    fs.writeFileSync(filePath, updatedContent, 'utf8');
    modifiedFiles.push(file);
    console.log(`Corretto ${file}`);
  }

  if (modifiedFiles.length === 0) {
    console.log('Nessun file da correggere.');
    return;
  }

  console.log(`Modificati ${modifiedFiles.length} file.`);
}

main();
