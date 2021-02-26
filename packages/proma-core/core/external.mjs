export class ExternalReference {
  // call with new ExternalReference({ myReference })
  constructor(externalReferenceObj) {
    const keys = Object.keys(externalReferenceObj);
    // TODO validate externalReferenceObj to be an object with 1 key
    // and value should have same .name as key
    this.reference = keys[0];
    this.value = externalReferenceObj[this.reference];
  }
}
