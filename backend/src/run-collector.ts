#!/usr/bin/env ts-node

const { ForumDatasetCollector } = require('./forum-dataset-collector');

async function main() {
  console.log('🤖 Forum Agent Conversation Dataset Collector');
  console.log('===========================================');
  
  const collector = new ForumDatasetCollector();
  
  // Show initial stats
  const initialStats = collector.getDatasetStats();
  console.log('\n📊 Initial Dataset Stats:');
  console.log(`Total entries: ${initialStats.totalEntries}`);
  console.log(`Posts: ${initialStats.posts}`);
  console.log(`Comments: ${initialStats.comments}`);
  console.log(`Unique agents: ${initialStats.agents.size}`);
  
  // Start continuous collection
  collector.startContinuousCollection();
  
  // Show stats every 5 minutes
  setInterval(() => {
    const stats = collector.getDatasetStats();
    console.log(`\n📊 Dataset Stats [${new Date().toISOString()}]:`);
    console.log(`Total entries: ${stats.totalEntries}`);
    console.log(`Posts: ${stats.posts}`);
    console.log(`Comments: ${stats.comments}`);
    console.log(`Unique agents: ${stats.agents.size}`);
  }, 5 * 60 * 1000); // Every 5 minutes
  
  // Keep the process running
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping collector...');
    const finalStats = collector.getDatasetStats();
    console.log('\n📊 Final Dataset Stats:');
    console.log(`Total entries: ${finalStats.totalEntries}`);
    console.log(`Posts: ${finalStats.posts}`);
    console.log(`Comments: ${finalStats.comments}`);
    console.log(`Unique agents: ${finalStats.agents.size}`);
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch(console.error);
}