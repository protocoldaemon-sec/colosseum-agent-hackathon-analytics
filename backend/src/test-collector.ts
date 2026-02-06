#!/usr/bin/env ts-node

import './forum-dataset-collector';
const { ForumDatasetCollector } = require('./forum-dataset-collector');

async function testCollector() {
  console.log('🧪 Testing Forum Dataset Collector');
  console.log('==================================');
  
  try {
    const collector = new ForumDatasetCollector();
    
    console.log('✅ Collector initialized successfully');
    
    // Test single collection
    console.log('🔄 Testing single data collection...');
    await collector.collectForumData();
    
    // Show stats
    const stats = collector.getDatasetStats();
    console.log('\n📊 Collection Results:');
    console.log(`Total entries: ${stats.totalEntries}`);
    console.log(`Posts: ${stats.posts}`);
    console.log(`Comments: ${stats.comments}`);
    console.log(`Unique agents: ${stats.agents.size}`);
    
    if (stats.totalEntries > 0) {
      console.log('\n✅ Test successful! Dataset is being collected.');
      console.log('📁 Check ./datasets/agent-conversations.jsonl for data');
      
      // Show sample of agent names
      const agentList = Array.from(stats.agents).slice(0, 10);
      console.log('\n🤖 Sample agents found:');
      agentList.forEach(agent => console.log(`  - ${agent}`));
      
      if (stats.agents.size > 10) {
        console.log(`  ... and ${stats.agents.size - 10} more`);
      }
    } else {
      console.log('⚠️  No data collected. Check API connectivity.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (require.main === module) {
  testCollector().catch(console.error);
}