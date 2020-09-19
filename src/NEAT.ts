import { Genome, StructureConfig, IFitnessFunction } from "./Genome";
import { Connection } from "./Connection";
import { Node, NodeType } from "./Node";
import { Species } from "./Species";

interface NEATConfig {
	populationSize: number;
	structure: StructureConfig;
	fitnessThreshold: number;
	maxEpoch: number;
	mutationRate?: MutationRateConfig;
	distanceConstants?: DistanceConfig;
	fitnessFunction: IFitnessFunction;
}

interface MutationRateConfig {
	addNodeMR: number;
	addConnectionMR: number;
	removeNodeMR: number;
	removeConnectionMR: number;
	changeWeightMR: number;
}

interface DistanceConfig {
	c1: number;
	c2: number;
	c3: number;
	compatibilityThreshold: number;
}

class NEAT {
	config: NEATConfig;
	species: Species[] = [];
	nodeInnovation: number;
	connectionInnovation: number;
	connectionDB: Connection[] = [];
	nodeDB: Node[] = [];

	constructor(config: NEATConfig) {

		this.config = config;

		config.structure.hidden = (config.structure.hidden !== undefined) ? config.structure.hidden : 0;
		this.nodeInnovation = config.structure.in + config.structure.hidden + config.structure.out - 1;
		this.connectionInnovation = 0;

		if (config.mutationRate) {
			config.mutationRate.addNodeMR = (config.mutationRate.addNodeMR !== undefined) ? config.mutationRate.addNodeMR : 0.01;
			config.mutationRate.addConnectionMR = (config.mutationRate.addConnectionMR !== undefined) ? config.mutationRate.addConnectionMR : 0.02;
			config.mutationRate.removeNodeMR = (config.mutationRate.removeNodeMR !== undefined) ? config.mutationRate.removeNodeMR : 0.005;
			config.mutationRate.removeConnectionMR = (config.mutationRate.removeConnectionMR !== undefined) ? config.mutationRate.removeConnectionMR : 0.005;
			config.mutationRate.changeWeightMR = (config.mutationRate.changeWeightMR !== undefined) ? config.mutationRate.changeWeightMR : 0.01;
		} else {
			config.mutationRate = { addNodeMR: 0.01, addConnectionMR: 0.02, removeNodeMR: 0.005, removeConnectionMR: 0.005, changeWeightMR: 0.01 };
		}

		this.species.push(new Species());
		for (let i = 0; i < config.populationSize; i++) {
			this.species[0].addGenome(new Genome({ in: config.structure.in, hidden: config.structure.hidden, out: config.structure.out, activationFunc: config.structure.activationFunc }));
		}
	}

	mutate() {
		this.species.forEach(specie => {
			specie.mutateNode(this.config.mutationRate.addNodeMR, this);
			specie.mutateConnection(this.config.mutationRate.addConnectionMR, this);
			specie.mutateDeactivateNode(this.config.mutationRate.removeNodeMR);
			specie.mutateDeactivateConnection(this.config.mutationRate.removeConnectionMR);
			specie.mutateWeight(this.config.mutationRate.changeWeightMR);
		});
	}

	speciate() {
		let genomes: Genome[] = [];
		for (let i = 0; i < this.species.length; i++) {
			genomes = genomes.concat(this.species[i].getGenomes());
		}

		this.species = Species.speciate(genomes, this.config.distanceConstants);
	}

	assignPopulationLimit() {
		let total = 0;
		this.species.forEach(specie => {
			total += specie.adjustFitness();
		});

		this.species.forEach(specie => {
			let normalized = specie.adjustedFitness / total;
			specie.populationCap = Math.floor(normalized * this.config.populationSize);
			if (isNaN(specie.populationCap) || specie.populationCap < 0) {
				specie.populationCap = 0;
			}
		});

		for (let i = this.species.length - 1; i >= 0; i--) {
			if (this.species[i].populationCap === 0 || this.species[i].genomes.length < 1) this.species.splice(i, 1);
		}
	}

	repopulate() {
		this.species.forEach(specie => {
			specie.repopulate(this.config.structure);
		});
	}

	run() {
		while (this.config.maxEpoch--) {
			let genomes: Genome[] = [];
			for (let i = 0; i < this.species.length; i++) {
				genomes = genomes.concat(this.species[i].getGenomes());
			}

			genomes.forEach(genome => {
				genome.fitness = this.config.fitnessFunction(genome);
			});

			this.speciate();
			this.assignPopulationLimit();
			this.repopulate();
			this.mutate();
		}
	}
}

export { NEAT, Connection, Node, NEATConfig, NodeType, Genome, MutationRateConfig, DistanceConfig, Species };
export * from "./ActivationFunction"; // This stupid thing is here because of an issue with rollup-plugin-typescript. Don't judge me.