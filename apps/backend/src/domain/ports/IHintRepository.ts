import { Hint } from '../entities/Hint';

export interface IHintRepository {
  save(hint: Hint): Promise<void>;
}
