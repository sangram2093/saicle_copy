# saicle

# in the enterprise environment

# create a keytab file using the kinit command

# `kinit <kerbid>@DBG.ADS.DB.COM

# set env variable CURL_OPTIONS

# export CURL_OPTIONS="-k -x http://sp-surf-proxy.intranet.db.com:8080 --proxy-user : --proxy-negotiate "

#### for build on macos especially for macos-arm64 build download the file https://github.com/vercel/pkg-fetch/releases/download/v3.4/node-v18-macos-arm64 and put that in the folder ~/.pkg-cache/v3.4/node-v18.5.0-macos-arm64 and rename that to fetched-v118.5.0-macos-arm64

#### for intellij gradle.build ad local artifactory in ~/.gradle/init.gradle

alloprojects {
repositories {
// mvn-gradle-plugins-cache
maven {

        }
        // add mvn-jetbrains-cache
        maven {

        }
        maven {
            url = uri("file://Users/<kerbid>/gradle_local_repo)
        }
    }

}

in gradle_local_repo add
add following files
| --- com
|--- intellij
|--- remoterobot
|--- remote-robot
|--- 0.11.23
|--- remote-robot-0.11.23.pom
|--- remote-robot-0.11.23.jar
|--- remote-fixtures
|--- 0.11.23
|--- remote-fixtures-0.11.23.jar
|--- remote-fixtures-0.11.23.pom

# check ~/.gradle/init.gradle and ~/.gradle/gradle.properties
