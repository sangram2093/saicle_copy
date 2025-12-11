//
//                                 Autocomplete, Edit, Chat, and Agent tutorial
//

// â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”     Autocomplete     â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” //
//                            Autocomplete provides inline code suggestions as you type.

// 1. Place cursor after `sortingAlgorithm:` below and press [Enter]
// 2. Press [Tab] to accept the Autocomplete suggestion

// Basic assertion for sortingAlgorithm:

// â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”     Edit      â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” //
//                   Edit is a convenient way to make quick changes to specific code and files.

// 1. Highlight the code below
// 2. Press [Cmd/Ctrl + I] to Edit
// 3. Try asking DbSaicle to "make this more readable"
public static int[] sortingAlgorithm(int[] x) {
    for (int i = 0; i < x.length; i++) {
        for (int j = 0; j < x.length - 1; j++) {
            if (x[j] > x[j + 1]) {
                int temp = x[j];
                x[j] = x[j + 1];
                x[j + 1] = temp;
            }
        }
    }
    return x;
}

// â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”     Chat      â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” //
//                    Chat makes it easy to ask for help from an LLM without needing to leave the IDE.

// 1. Highlight the code below
// 2. Press [Cmd/Ctrl + J] to add to Chat
// 3. Try asking DbSaicle "what sorting algorithm is this?"
public static int[] sortingAlgorithm2(int[] x) {
    for (int i = 0; i < x.length; i++) {
        for (int j = 0; j < x.length - 1; j++) {
            if (x[j] > x[j + 1]) {
                int temp = x[j];
                x[j] = x[j + 1];
                x[j + 1] = temp;
            }
        }
    }
    return x;
}

// â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”     Agent      â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” //
//            Agent equips the Chat model with the tools needed to handle a wide range of coding tasks, allowing
//            the model to make decisions and save you the work of manually finding context and performing actions.

// 1. Switch from "Chat" to "Agent" mode using the dropdown in the bottom left of the input box
// 2. Use the "/init" slash command to generate a DBSAICLE.md file

// â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”      Learn more at https://docs.dbsaicle.dev/getting-started/overview      â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” //