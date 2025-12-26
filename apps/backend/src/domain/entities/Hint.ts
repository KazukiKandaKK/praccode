export interface Hint {
    exerciseId: string;
    userId: string;
    questionIndex: number;
    hintText: string;
    createdAt: Date;
}
  
export class HintEntity implements Hint {
    public readonly createdAt: Date;

    constructor(
        public readonly exerciseId: string,
        public readonly userId: string,
        public readonly questionIndex: number,
        public readonly hintText: string,
    ) {
        this.createdAt = new Date();
    }
}  
