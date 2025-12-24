
// scripts/test_periodization.ts
import { PeriodizationEngine, PeriodizationPhase } from '../utils/periodizationEngine';
import { Competition } from '../types';

const runTest = () => {
    const today = new Date('2025-01-01');
    console.log(`Test Date: ${today.toISOString().split('T')[0]}`);

    const makeComp = (name: string, daysFromNow: number): Competition => {
        const d = new Date(today);
        d.setDate(d.getDate() + daysFromNow);
        return {
            id: '1',
            name,
            date: d.toISOString().split('T')[0],
            priority: 'A'
        };
    };

    // Case 1: Taper (10 days out)
    const taperComp = makeComp("Olympics", 10);
    const phase1 = PeriodizationEngine.calculateCurrentPhase([taperComp], today);
    console.log(`\nCase 1 (10 days out): Expected [Competition], Got [${phase1.name}]`);
    if (phase1.name === 'Competition') console.log("✅ PASS"); else console.log("❌ FAIL");

    // Case 2: Specific Prep (8 weeks / 56 days out)
    const sppComp = makeComp("Nationals", 56);
    const phase2 = PeriodizationEngine.calculateCurrentPhase([sppComp], today);
    console.log(`\nCase 2 (8 weeks out): Expected [Specific Prep], Got [${phase2.name}]`);
    if (phase2.name === 'Specific Prep') console.log("✅ PASS"); else console.log("❌ FAIL");

    // Case 3: General Prep (20 weeks / 140 days out)
    const gppComp = makeComp("Worlds", 140);
    const phase3 = PeriodizationEngine.calculateCurrentPhase([gppComp], today);
    console.log(`\nCase 3 (20 weeks out): Expected [General Prep], Got [${phase3.name}]`);
    if (phase3.name === 'General Prep') console.log("✅ PASS"); else console.log("❌ FAIL");

    // Case 4: No Comps
    const phase4 = PeriodizationEngine.calculateCurrentPhase([], today);
    console.log(`\nCase 4 (No Comps): Expected [General Prep], Got [${phase4.name}]`);
    if (phase4.name === 'General Prep') console.log("✅ PASS"); else console.log("❌ FAIL");
};

runTest();
