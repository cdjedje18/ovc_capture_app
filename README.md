# OVC Capture app

This is a modified version of the DHIS2 native Capture app, with the goal of implementing custom functionalities such as
multiple data entry to address the needs of the OVC project.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

What things you need to install and how to install them.

#### Node 

You can download and install Node on your machine from [here](https://nodejs.org/en/download/).

#### Git 

You can find a tutorial on how to install `git` on your machine [here](https://www.atlassian.com/git/tutorials/install-git).

#### Yarn 1

You can install `yarn 1` on your machine following the instructions [here](https://classic.yarnpkg.com/en/docs/install/).


### Installing

Step by step instructions for setting up a development environment.


#### 1. Install project dependencies

To install the dependencies you will have to be at the source folder of the cloned repository. Then run:

```
yarn 
```
#### 2. Run the application

In the package.json file change the following line with your dev instance:

```
"start": "d2-app-scripts start --proxy <your-dev-instance-url>",
```

To start the application locally and interact with it in the browser, run:

```
yarn start
```

After the execution you will see to introduce the credentials, fill the fields with the following data:
> server: http://localhost:8080
> username: <your-username>
> password: <your-password>

#### 4. Build the application

To build the application locally run:

```
yarn build
```