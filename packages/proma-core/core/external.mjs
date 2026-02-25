export class ExternalReference {
  /**
   * Creates a reference wrapper that compilers can convert into identifiers.
   *
   * Call with `new ExternalReference({ myReference })`.
   *
   * @param {{ [name: string]: any }} externalReferenceObj
   */
  constructor(externalReferenceObj) {
    const keys = Object.keys(externalReferenceObj);
    /**
     * TODO validate externalReferenceObj to be an object with 1 key
     * and value should have same .name as key.
     *
     * @type {string}
     */
    this.reference = keys[0];
    /** @type {any} */
    this.value = externalReferenceObj[this.reference];
  }
}
