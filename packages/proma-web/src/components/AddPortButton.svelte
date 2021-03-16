<button class="AddPortButton" type="button" on:click>
  <div class="AddPortButton-icon">
    <svg
      width="14px"
      height="14px"
      viewBox="0 0 14 14"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
    >
      <path
        d="M8,0 C8.55228475,-1.01453063e-16 9,0.44771525 9,1 L9,5 L13,5 C13.5522847,5 14,5.44771525 14,6 L14,8 C14,8.55228475 13.5522847,9 13,9 L9,9 L9,13 C9,13.5522847 8.55228475,14 8,14 L6,14 C5.44771525,14 5,13.5522847 5,13 L5,8.999 L1,9 C0.44771525,9 0,8.55228475 0,8 L0,6 C0,5.44771525 0.44771525,5 1,5 L5,4.999 L5,1 C5,0.44771525 5.44771525,1.01453063e-16 6,0 L8,0 Z"
        fill="currentColor"
      />
    </svg>
  </div>
  <div class="AddPortButton-label">Add port</div>
</button>

<style>
  .AddPortButton {
    display: flex;
    padding: 5px;
    border: 1px solid transparent;
    border-radius: 3px;
    background-color: transparent;
    cursor: default;

    font-family: inherit;
    color: var(--proma-board--chip--color, white);
    cursor: pointer;
    outline: none;

    transition-property: border-color, background-color;
    transition-duration: var(--proma-board-transition-duration, 0.25s);
    transition-timing-function: var(
      --proma-board-transition-timing-function,
      ease
    );
  }

  .AddPortButton:hover {
    background-color: var(--proma-board--port-hover--background-color, #575757);
  }

  .AddPortButton-icon {
    color: var(--proma-board--type-exec, #e7e7e7);
  }

  .AddPortButton-label {
    padding: 0 8px;
    white-space: nowrap;
  }

  :global(.ChipOutputPorts) .AddPortButton {
    flex-direction: row-reverse;
  }
</style>
