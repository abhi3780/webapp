pipeline {
  agent any 
  tools {
    maven 'm3-2-5'
  }
  stages {
    stage ('Initialize') {
      steps {
        sh '''
                    echo "PATH = ${PATH}"
                    echo "M2_HOME = ${M2_HOME}"
            ''' 
      }
    }    
    stage ('Build') {
      steps {
      sh 'mvn clean package -X'
      sh 'ls /var/jenkins_home/workspace/webapp/target'
      sh 'sshpass -p Stellantis01 ssh devuser@10.109.137.30 "uptime && date" '
      sh 'echo ----------------------------'
      sh 'sudo docker cp /var/lib/docker/volumes/d39ec24666c4194ae2555d6b5e7f277a4886cc0876baa53ed51e6bc31cf42fdd/_data/workspace/webapp_pipeline/target/WebApp 1c970ff6d9fd383312d551aa21e7a12efd50a21c927a785b7dd8108ab3c936ad:/usr/local/tomcat/webapps'
       }
    }
   }
 }
