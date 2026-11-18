import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class ApplicationController extends Controller {
  queryParams = ['inspect'];

  @tracked inspect = false;

  @action
  toggleInspect(): void {
    this.inspect = !this.inspect;
  }

  @action
  exitInspect(): void {
    this.inspect = false;
  }
}
