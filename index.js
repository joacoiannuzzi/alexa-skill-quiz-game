const Alexa = require("ask-sdk-core");

function getRemoteData(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? require("https") : require("http");
    const request = client.get(url, (response) => {
      if (response.statusCode < 200 || response.statusCode > 299) {
        reject(new Error("Failed with status code: " + response.statusCode));
      }
      const body = [];
      response.on("data", (chunk) => body.push(chunk));
      response.on("end", () => resolve(JSON.parse(body.join(""))));
    });
    request.on("error", (err) => reject(err));
  });
}

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    );
  },
  handle(handlerInput) {
    const speakOutput =
      "Welcome to the quiz game, I will ask you some questions. Ready to start?";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

const YesIntentHandler = {
  canHandle(handlerInput) {
    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes();
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.YesIntent" &&
      sessionAttributes.isPlaying !== true
    );
  },
  async handle(handlerInput) {
    const questions = await getRemoteData(
      "https://the-trivia-api.com/v2/questions?limit=6"
    );
    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes();

    const currentQuestionIndex = 0;

    const currentQuestion = questions[currentQuestionIndex];

    const possibleAnswers = shuffle([
      currentQuestion.correctAnswer,
      ...currentQuestion.incorrectAnswers.slice(0, 3),
    ]);

    const correctAnswerIndex = possibleAnswers.indexOf(
      currentQuestion.correctAnswer
    );

    const correctAnswersToQuestions = [correctAnswerIndex];

    const isPlaying = true;

    const speakOutput =
      "Great! Here is the first question. " +
      currentQuestion.question.text +
      " Your options are: " +
      `A: ${possibleAnswers[0]}, B: ${possibleAnswers[1]}, C: ${possibleAnswers[2]}, D: ${possibleAnswers[3]}`;

    Object.assign(sessionAttributes, {
      currentQuestionIndex,
      correctAnswersToQuestions,
      questions,
      isPlaying,
      score: 0,
    });

    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

const NoIntentHandler = {
  canHandle(handlerInput) {
    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes();
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.NoIntent" &&
      sessionAttributes.isPlaying !== true
    );
  },
  handle(handlerInput) {
    const speakOutput = "Ok, we'll play another time. Goodbye!";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .withShouldEndSession(true)
      .getResponse();
  },
};

const AnswerIntentHandler = {
  canHandle(handlerInput) {
    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes();
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AnswerIntent" &&
      sessionAttributes.isPlaying === true
    );
  },
  handle(handlerInput) {
    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes();

    let speakOutput = "";

    let letterAnswer = "";

    const intent = handlerInput.requestEnvelope.request.intent;

    const letterResolution =
      intent.slots &&
      intent.slots.Answer &&
      intent.slots.Answer.resolutions &&
      intent.slots.Answer.resolutions.resolutionsPerAuthority &&
      intent.slots.Answer.resolutions.resolutionsPerAuthority[0] &&
      intent.slots.Answer.resolutions.resolutionsPerAuthority[0].values &&
      intent.slots.Answer.resolutions.resolutionsPerAuthority[0].values[0] &&
      intent.slots.Answer.resolutions.resolutionsPerAuthority[0].values[0]
        .value &&
      intent.slots.Answer.resolutions.resolutionsPerAuthority[0].values[0].value
        .name;

    if (letterResolution) {
      letterAnswer = letterResolution;
    } else {
      const answer =
        intent.slots &&
        intent.slots.Answer &&
        intent.slots.Answer.value &&
        intent.slots.Answer.value.toLowerCase().replace(/[^a-zA-Z]/g, "");

      letterAnswer = answer;
    }

    console.log({
      intent,
      letterAnswer,
    });

    if (!["a", "b", "c", "d"].includes(letterAnswer)) {
      speakOutput = "Please choose one of the options!";
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    }

    const numberAnswer = ["a", "b", "c", "d"].indexOf(
      letterAnswer.toLowerCase()
    );

    const questions = sessionAttributes.questions;
    const correctAnswersToQuestions =
      sessionAttributes.correctAnswersToQuestions;

    const correctAnswerIndex =
      correctAnswersToQuestions[sessionAttributes.currentQuestionIndex];

    const isCorrect = correctAnswerIndex === numberAnswer;

    if (isCorrect) {
      sessionAttributes.score++;
      speakOutput += "That's correct! ";
    } else {
      speakOutput +=
        "The correct answer is " +
        questions[sessionAttributes.currentQuestionIndex].correctAnswer +
        "! ";
    }

    sessionAttributes.currentQuestionIndex++;

    const currentQuestion = questions[sessionAttributes.currentQuestionIndex];

    if (currentQuestion) {
      const possibleAnswers = shuffle([
        currentQuestion.correctAnswer,
        ...currentQuestion.incorrectAnswers.slice(0, 3),
      ]);

      const nextCorrectAnswerIndex = possibleAnswers.indexOf(
        currentQuestion.correctAnswer
      );

      sessionAttributes.correctAnswersToQuestions.push(nextCorrectAnswerIndex);

      speakOutput +=
        "Here is your next question. " +
        currentQuestion.question.text +
        " Your options are: " +
        `A: ${possibleAnswers[0]}, B: ${possibleAnswers[1]}, C: ${possibleAnswers[2]}, D: ${possibleAnswers[3]}`;

      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    } else {
      const score = sessionAttributes.score;
      const numberOfQuestions = questions.length;
      sessionAttributes.isPlaying = false;
      speakOutput +=
        "That is all! You scored " +
        score +
        " out of " +
        numberOfQuestions +
        ". Would you like to play again?";

      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    }
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.CancelIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) ===
          "AMAZON.StopIntent")
    );
  },
  handle(handlerInput) {
    const speakOutput = "Goodbye!";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .withShouldEndSession(true)
      .getResponse();
  },
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet
 * */
const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.FallbackIntent"
    );
  },
  handle(handlerInput) {
    const speakOutput = "Sorry, I don't know about that. Please try again.";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs
 * */
const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
      "SessionEndedRequest"
    );
  },
  handle(handlerInput) {
    console.log(
      `~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`
    );
    // Any cleanup logic goes here.
    return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
  },
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents
 * by defining them above, then also adding them to the request handler chain below
 * */
const IntentReflectorHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
    );
  },
  handle(handlerInput) {
    // const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
    const speakOutput = `Please respond correctly`;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below
 * */
const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    const speakOutput =
      "Sorry, I had trouble doing what you asked. Please try again.";
    console.log(`~~ Error handled: ${JSON.stringify(error)}`);

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom
 * */
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    YesIntentHandler,
    NoIntentHandler,
    AnswerIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler,
    IntentReflectorHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
