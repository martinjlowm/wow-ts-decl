# Generate type data
./scripts/scrape-wow-ui-source.ts 1.15.4 11.0.7
./scripts/scrape-warcraft-wiki.ts

# Emit TypeScript declarations
./scripts/merge-sources.ts 1.15.4 11.0.7
